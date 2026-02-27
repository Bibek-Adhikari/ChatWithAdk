import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import paymentsRouter from './routes/payments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(REPO_ROOT, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// --- Firebase Admin Init (for verifying Firebase ID tokens) ---
let firebaseAdminReady = false;
const initFirebaseAdmin = () => {
  if (firebaseAdminReady) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  try {
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
      firebaseAdminReady = true;
      return;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({ credential: applicationDefault() });
      firebaseAdminReady = true;
      return;
    }

    console.warn('Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
};

initFirebaseAdmin();

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
app.use(express.json()); // MUST be before route handlers
app.use('/api/payments', paymentsRouter);

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
    }
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

// ─── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ChatADK Express Server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Keys:   http://localhost:${PORT}/api/keys/status`);
  console.log(`   Convert: POST http://localhost:${PORT}/api/convert`);
  console.log(`\n`);
});
