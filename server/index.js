import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import paymentsRouter from './routes/payments.js';
import proxyRouter from './routes/proxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(REPO_ROOT, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// --- Firebase Admin Init (for verifying Firebase ID tokens) ---
// The service account MUST belong to the same project as the web app
// (VITE_FIREBASE_PROJECT_ID). A mismatch silently 401s every /api route.
let firebaseAdminReady = false;
let firebaseAdminProject = null;
const WEB_FIREBASE_PROJECT = process.env.VITE_FIREBASE_PROJECT_ID || null;

const initFirebaseAdmin = () => {
  if (firebaseAdminReady) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  try {
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      firebaseAdminProject = serviceAccount.project_id || null;
      initializeApp({ credential: cert(serviceAccount) });
      firebaseAdminReady = true;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({ credential: applicationDefault() });
      firebaseAdminReady = true;
    } else {
      console.warn('Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
      return;
    }

    if (firebaseAdminProject && WEB_FIREBASE_PROJECT && firebaseAdminProject !== WEB_FIREBASE_PROJECT) {
      console.error(
        `\n⚠️  FIREBASE PROJECT MISMATCH — server auth is DISABLED in practice:\n` +
        `   service account project: '${firebaseAdminProject}'\n` +
        `   web app project (VITE_FIREBASE_PROJECT_ID): '${WEB_FIREBASE_PROJECT}'\n` +
        `   verifyIdToken() will reject every user token (401 on all /api routes)\n` +
        `   and clients fall back to direct provider keys (no quotas enforced).\n` +
        `   FIX: Firebase Console → ${WEB_FIREBASE_PROJECT} → Project Settings →\n` +
        `   Service accounts → Generate new private key → replace FIREBASE_SERVICE_ACCOUNT_JSON in .env.\n`
      );
    } else if (firebaseAdminReady) {
      console.log(`Firebase Admin ready (project: ${firebaseAdminProject || 'application-default'}).`);
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
};

initFirebaseAdmin();

export const getFirebaseAdminStatus = () => ({
  ready: firebaseAdminReady,
  adminProject: firebaseAdminProject,
  webProject: WEB_FIREBASE_PROJECT,
  projectMatch:
    !firebaseAdminProject || !WEB_FIREBASE_PROJECT
      ? null
      : firebaseAdminProject === WEB_FIREBASE_PROJECT,
});

// --- Supabase Admin Client (Service Role) ---
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_APP_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    })
  : null;

const ensureSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
};

const requireFirebaseAuth = async (req, res, next) => {
  if (!firebaseAdminReady) {
    return res.status(500).json({ error: 'Firebase Admin not configured on server.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token.' });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.firebaseUser = decoded;
    return next();
  } catch (error) {
    console.error('Firebase token verification failed:', error?.message || error);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Middleware
app.use(cors());
app.set('trust proxy', 1); // Enable trust proxy for correct IP detection behind load balancers
app.use(express.json({ limit: '15mb' })); // MUST be before route handlers (base64 images via proxy)
app.use('/api/payments', paymentsRouter);
app.use('/api/proxy', proxyRouter);

// ─── Health Check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      gemini: !!process.env.VITE_GEMINI_API_KEY,
      groq: !!process.env.VITE_GROQ_API_KEY,
      openrouter: !!process.env.VITE_OPENROUTER_API_KEY,
      youtube: !!process.env.VITE_YOUTUBE_API_KEY,
      firebase: !!process.env.VITE_FIREBASE_API_KEY,
      worldnews: !!process.env.VITE_WORLD_NEWS_API_KEY,
      newsdata: !!process.env.VITE_NEWSDATA_API_KEY,
      codecraft: !!process.env.VITE_CODECRAFT_API_KEY,
      supabase: !!(process.env.SUPABASE_URL || process.env.VITE_APP_SUPABASE_URL),
    },
    firebaseAdmin: getFirebaseAdminStatus(),
    proxy: true,
  });
});

// ─── Route Validation ────────────────────────────────────────────
// Returns the correct overlay state for a given path
const VALID_OVERLAYS = {
  'codeadk': 'compiler',
  'converteradk': 'converter',
  'converteradk/history': 'converter-history',
};
app.get('/api/route/resolve', (req, res) => {
  const { path: routePath, sessionId } = req.query;

  // If the path is an overlay path, return overlay info
  if (sessionId && VALID_OVERLAYS[sessionId]) {
    const overlayType = VALID_OVERLAYS[sessionId];
    return res.json({
      type: 'overlay',
      overlay: overlayType === 'converter-history' ? 'converter' : overlayType,
      sessionId: null,
      redirect: false,
      showHistory: overlayType === 'converter-history'
    });
  }

  // If it's a regular session path
  if (sessionId && sessionId.startsWith('new_')) {
    return res.json({
      type: 'session',
      overlay: null,
      sessionId: sessionId,
      isNew: true,
      redirect: false
    });
  }

  if (sessionId) {
    return res.json({
      type: 'session',
      overlay: null,
      sessionId: sessionId,
      isNew: false,
      redirect: false
    });
  }

  // Root path - no session
  return res.json({
    type: 'home',
    overlay: null,
    sessionId: null,
    redirect: false
  });
});

// ─── API Key Status ──────────────────────────────────────────────
app.get('/api/keys/status', (req, res) => {
  const keys = {
    gemini: { 
      configured: !!process.env.VITE_GEMINI_API_KEY,
      masked: process.env.VITE_GEMINI_API_KEY 
        ? process.env.VITE_GEMINI_API_KEY.substring(0, 6) + '...' + process.env.VITE_GEMINI_API_KEY.slice(-4)
        : null
    },
    groq: { 
      configured: !!process.env.VITE_GROQ_API_KEY,
      masked: process.env.VITE_GROQ_API_KEY
        ? process.env.VITE_GROQ_API_KEY.substring(0, 6) + '...' + process.env.VITE_GROQ_API_KEY.slice(-4)
        : null
    },
    openrouter: { 
      configured: !!process.env.VITE_OPENROUTER_API_KEY,
      masked: process.env.VITE_OPENROUTER_API_KEY
        ? process.env.VITE_OPENROUTER_API_KEY.substring(0, 8) + '...' + process.env.VITE_OPENROUTER_API_KEY.slice(-4)
        : null
    },
    youtube: { configured: !!process.env.VITE_YOUTUBE_API_KEY },
    firebase: { configured: !!process.env.VITE_FIREBASE_API_KEY },
    worldnews: { configured: !!process.env.VITE_WORLD_NEWS_API_KEY },
    newsdata: { configured: !!process.env.VITE_NEWSDATA_API_KEY },
  };
  res.json(keys);
});

// --- Supabase Gateway: Conversion History ---
app.get('/api/supabase/conversion-history', requireFirebaseAuth, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const uid = req.firebaseUser?.uid;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const { data, error } = await supabase
      .from('conversion_history')
      .select('*')
      .eq('user_id', uid)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const mapped = (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      sourceLang: row.source_lang,
      targetLang: row.target_lang,
      sourceCode: row.source_code,
      targetCode: row.target_code,
      timestamp: new Date(row.timestamp).getTime()
    }));

    return res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Supabase history fetch error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch conversion history.' });
  }
});

app.post('/api/supabase/conversion-history', requireFirebaseAuth, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const uid = req.firebaseUser?.uid;
    const {
      id,
      sourceLang,
      targetLang,
      sourceCode,
      targetCode,
      timestamp
    } = req.body || {};

    if (!sourceLang || !targetLang || !sourceCode || typeof targetCode !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const recordId = id || `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ts = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    const { error } = await supabase
      .from('conversion_history')
      .upsert({
        id: recordId,
        user_id: uid,
        source_lang: sourceLang,
        target_lang: targetLang,
        source_code: sourceCode,
        target_code: targetCode,
        timestamp: ts
      });

    if (error) {
      throw error;
    }

    return res.json({ success: true, id: recordId });
  } catch (error) {
    console.error('Supabase history upsert error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save conversion history.' });
  }
});

app.delete('/api/supabase/conversion-history/:id', requireFirebaseAuth, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const uid = req.firebaseUser?.uid;
    const { id } = req.params;

    const { error } = await supabase
      .from('conversion_history')
      .delete()
      .eq('user_id', uid)
      .eq('id', id);

    if (error) {
      throw error;
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Supabase history delete error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to delete conversion history.' });
  }
});

app.delete('/api/supabase/conversion-history', requireFirebaseAuth, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const uid = req.firebaseUser?.uid;

    const { error } = await supabase
      .from('conversion_history')
      .delete()
      .eq('user_id', uid);

    if (error) {
      throw error;
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Supabase history clear error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to clear conversion history.' });
  }
});

// ─── Code Conversion Proxy ──────────────────────────────────────
// This endpoint acts as a server-side proxy for code conversion,
// keeping API keys secure and providing centralized error handling.
app.post('/api/convert', async (req, res) => {
  const { code, sourceLanguage, targetLanguage } = req.body;

  if (!code || !sourceLanguage || !targetLanguage) {
    return res.status(400).json({ error: 'Missing required fields: code, sourceLanguage, targetLanguage' });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on the server.' });
  }

  try {
    const prompt = `You are a professional code converter.
Convert the following ${sourceLanguage} code to ${targetLanguage} code.

RULES:
1. Output ONLY the converted code.
2. DO NOT include triple backticks or any markdown formatting.
3. DO NOT include explanations, comments about the conversion, or extra text.
4. Maintain the logic and functionality exactly.
5. Use modern, idiomatic syntax for the target language.

SOURCE CODE:
${code}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const convertedCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    res.json({
      success: true,
      code: convertedCode.trim(),
      confidence: 95,
      model: 'gemini-2.0-flash'
    });
  } catch (error) {
    console.error('Conversion Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// --- Admin guard: verified Firebase email must be allow-listed ---
// (Defined here, before any route that references it.)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'crazybibek4444@gmail.com,bibekadhikari0763@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const requireAdmin = (req, res, next) => {
  const email = (req.firebaseUser?.email || '').toLowerCase();
  if (!email || !ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  next();
};

// ─── Admin Gateway (Firebase Admin SDK — bypasses locked rules) ─────────────
// firestore.rules denies ALL client writes to users/* and system/* and all
// cross-user reads, so the client can never do these directly. These routes
// verify the Firebase ID token and perform the reads/writes with the Admin
// SDK. UID/email always come from the verified token, never the request body.

// Upsert the signed-in user's profile for admin tracking. Safe to call on
// every login; merge keeps first-seen createdAt.
app.post('/api/admin/sync-user', requireFirebaseAuth, async (req, res) => {
  try {
    const { uid, email, name, picture } = req.firebaseUser || {};
    if (!uid) return res.status(401).json({ success: false, error: 'No verified user.' });

    const db = getFirestore();
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get().catch(() => null);
    await ref.set(
      {
        uid,
        email: email || null,
        displayName: name || null,
        photoURL: picture || null,
        lastLogin: FieldValue.serverTimestamp(),
        ...(!snap || !snap.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
      },
      { merge: true }
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin sync-user error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to sync user.' });
  }
});

// Latest users (admin only).
app.get('/api/admin/users', requireFirebaseAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 200);
    const snap = await getFirestore()
      .collection('users')
      .orderBy('lastLogin', 'desc')
      .limit(limit)
      .get();
    const users = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        ...data,
        lastLogin: data.lastLogin?.toMillis ? data.lastLogin.toMillis() : Date.now(),
      };
    });
    return res.json({ success: true, data: users });
  } catch (error) {
    console.error('Admin users error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch users.' });
  }
});

// System-wide counts (admin only).
app.get('/api/admin/stats', requireFirebaseAuth, requireAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const [usersCount, sessionsCount] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('sessions').count().get(),
    ]);
    return res.json({
      success: true,
      data: { totalUsers: usersCount.data().count, totalSessions: sessionsCount.data().count },
    });
  } catch (error) {
    console.error('Admin stats error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch stats.' });
  }
});

const DEFAULT_MODEL_CONFIG = { fast: 'groq', research: 'research', detail: 'gemini', imagine: 'imagine', motion: 'motion' };
const MODEL_CONFIG_KEYS = ['fast', 'research', 'detail'];
const MODEL_ENGINE_VALUES = ['groq', 'gemini', 'research', 'openrouter'];

// Model config read (any signed-in user — the chat needs it to route modes).
app.get('/api/admin/model-config', requireFirebaseAuth, async (req, res) => {
  try {
    const snap = await getFirestore().collection('system').doc('config').get().catch(() => null);
    const data = snap && snap.exists ? snap.data() : {};
    return res.json({ success: true, data: { ...DEFAULT_MODEL_CONFIG, ...(data || {}) } });
  } catch (error) {
    console.error('Admin model-config read error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch model config.' });
  }
});

// Model config write (admin only, values validated).
app.post('/api/admin/model-config', requireFirebaseAuth, requireAdmin, async (req, res) => {
  try {
    const clean = {};
    for (const key of MODEL_CONFIG_KEYS) {
      const v = req.body?.[key];
      if (typeof v === 'string' && MODEL_ENGINE_VALUES.includes(v)) clean[key] = v;
    }
    if (Object.keys(clean).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid config fields.' });
    }
    await getFirestore().collection('system').doc('config').set(clean, { merge: true });
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin model-config write error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save model config.' });
  }
});

// ─── Supabase Gateway: Chat Backup (per-user, Firebase-verified) ───────────
// The browser never touches Supabase. Every route below verifies the Firebase
// ID token, takes the UID from the verified token, and uses the service-role
// key. Tables live in a locked-down project (supabase/schema.sql).

// Save (upsert) one chat session + replace its messages. UID comes from token.
app.post('/api/supabase/chat/sessions', requireFirebaseAuth, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const uid = req.firebaseUser?.uid;
    const { id, title, updatedAt, messages } = req.body || {};

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing session id.' });
    }

    // Never let one user overwrite another user's session id.
    const { data: existing, error: lookupError } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing && existing.user_id !== uid) {
      return res.status(403).json({ success: false, error: 'Session belongs to another user.' });
    }

    const { error: sessionError } = await supabase.from('sessions').upsert({
      id,
      user_id: uid,
      title: typeof title === 'string' && title ? title.slice(0, 200) : 'New conversation',
      updated_at: updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString(),
    });
    if (sessionError) throw sessionError;

    const { error: deleteError } = await supabase.from('messages').delete().eq('session_id', id);
    if (deleteError) throw deleteError;

    const clean = Array.isArray(messages)
      ? messages
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
          .slice(0, 500)
          .map((m) => ({
            session_id: id,
            role: m.role,
            parts: Array.isArray(m.parts) ? m.parts : [],
            model_id: typeof m.modelId === 'string' ? m.modelId : null,
            timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
          }))
      : [];

    if (clean.length > 0) {
      const { error: messageError } = await supabase.from('messages').insert(clean);
      if (messageError) throw messageError;
    }

    return res.json({ success: true, id });
  } catch (error) {
    console.error('Supabase chat save error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save chat session.' });
  }
});

// Delete one chat session (scoped to the verified user).
app.delete('/api/supabase/chat/sessions/:id', requireFirebaseAuth, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const uid = req.firebaseUser?.uid;
    const { id } = req.params;

    await supabase.from('messages').delete().eq('session_id', id);
    const { error } = await supabase.from('sessions').delete().eq('id', id).eq('user_id', uid);
    if (error) throw error;

    return res.json({ success: true });
  } catch (error) {
    console.error('Supabase chat delete error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to delete chat session.' });
  }
});

// List one session's user prompts (prompt-tree source, scoped to the verified user).
app.get('/api/supabase/chat/sessions/:id/prompts', requireFirebaseAuth, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const uid = req.firebaseUser?.uid;
    const { id } = req.params;

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session || session.user_id !== uid) {
      return res.status(404).json({ success: false, error: 'Session not found.' });
    }

    const { data, error } = await supabase
      .from('messages')
      .select('role, parts, timestamp')
      .eq('session_id', id)
      .eq('role', 'user')
      .order('timestamp', { ascending: true })
      .limit(500);
    if (error) throw error;

    const prompts = (data || []).map((m, i) => {
      const parts = Array.isArray(m.parts) ? m.parts : [];
      const text = parts
        .filter((p) => p && (p.type === 'text' || typeof p.text === 'string'))
        .map((p) => p.text || p.content || '')
        .join('\n')
        .trim();
      return { id: `${id}-prompt-${i}`, text: text || '[image]', timestamp: m.timestamp };
    }).filter((p) => p.text);
    return res.json({ success: true, data: prompts });
  } catch (error) {
    console.error('Supabase session prompts error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch prompts.' });
  }
});

// Admin: list all sessions with message counts (for the dashboard History tab).
app.get('/api/supabase/admin/sessions', requireFirebaseAuth, requireAdmin, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

    const { data, error } = await supabase
      .from('sessions')
      .select('*, messages(count)')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Supabase admin sessions error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch sessions.' });
  }
});

// ─── Supabase Gateway: Image Tool Jobs (per-user history) ───────────────────
app.post('/api/supabase/image-jobs', requireFirebaseAuth, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const uid = req.firebaseUser?.uid;
    const { tool, prompt, outputUrl, status } = req.body || {};

    if (!tool || typeof tool !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing tool name.' });
    }

    const { data, error } = await supabase
      .from('image_jobs')
      .insert({
        user_id: uid,
        tool: tool.slice(0, 60),
        prompt: typeof prompt === 'string' ? prompt.slice(0, 2000) : '',
        output_url: typeof outputUrl === 'string' ? outputUrl.slice(0, 2000) : null,
        status: status === 'error' ? 'error' : 'complete',
      })
      .select('id')
      .single();
    if (error) throw error;

    return res.json({ success: true, id: data?.id });
  } catch (error) {
    console.error('Supabase image job log error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to log image job.' });
  }
});

app.get('/api/supabase/image-jobs', requireFirebaseAuth, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const uid = req.firebaseUser?.uid;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const { data, error } = await supabase
      .from('image_jobs')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Supabase image jobs fetch error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch image jobs.' });
  }
});

// ─── Supabase Gateway: Code Explanations ─────────────────────────────────────
app.post('/api/supabase/explanations', requireFirebaseAuth, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const uid = req.firebaseUser?.uid;
    const { language, code, explanation } = req.body || {};

    if (!code || !explanation) {
      return res.status(400).json({ success: false, error: 'Missing code or explanation.' });
    }

    const { error } = await supabase.from('code_explanations').insert({
      user_id: uid,
      language: typeof language === 'string' ? language.slice(0, 60) : '',
      code: String(code).slice(0, 20000),
      explanation: String(explanation).slice(0, 20000),
    });
    if (error) throw error;

    return res.json({ success: true });
  } catch (error) {
    console.error('Supabase explanation save error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save explanation.' });
  }
});

// Admin: latest explanations across users (for the dashboard History tab).
app.get('/api/supabase/admin/explanations', requireFirebaseAuth, requireAdmin, async (req, res) => {
  try {
    const supabase = ensureSupabaseAdmin();
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const { data, error } = await supabase
      .from('code_explanations')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Supabase admin explanations error:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch explanations.' });
  }
});

// ─── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Tufan Express Server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Keys:   http://localhost:${PORT}/api/keys/status`);
  console.log(`   Convert: POST http://localhost:${PORT}/api/convert`);
  console.log(`\n`);
});
