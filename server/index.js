import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(REPO_ROOT, '.env.local') });

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
app.use(express.json());

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

const runFlowchartGenerator = (code) => {
  const pythonScript = `
import sys
from pyflowchart import Flowchart

source = sys.stdin.read()
if not source.strip():
    print("No code provided", file=sys.stderr)
    sys.exit(1)

try:
    flow = Flowchart.from_code(source)
    print(flow.flowchart())
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(2)
`;

  const runWith = (command, args = []) => new Promise((resolve, reject) => {
    const proc = spawn(command, [...args, '-c', pythonScript], { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (exitCode) => {
      if (exitCode === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || 'Failed to generate flowchart'));
      }
    });

    proc.stdin.write(code);
    proc.stdin.end();
  });

  const configuredPython = process.env.FLOWCHART_PYTHON?.trim();
  const candidatePaths = [
    configuredPython || null,
    path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe'),
    path.join(REPO_ROOT, '.venv', 'bin', 'python'),
    path.join(process.cwd(), '.venv', 'Scripts', 'python.exe'),
    path.join(process.cwd(), '.venv', 'bin', 'python')
  ].filter(Boolean);

  const pathCandidates = candidatePaths
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => ({ command: candidate, args: [] }));

  const commandCandidates = [
    { command: 'python', args: [] },
    { command: 'py', args: ['-3'] }
  ];

  const candidates = [...pathCandidates, ...commandCandidates];

  const tryCandidate = (index = 0) => {
    if (index >= candidates.length) {
      return Promise.reject(new Error('No working Python interpreter found for flowchart generation.'));
    }

    const candidate = candidates[index];
    return runWith(candidate.command, candidate.args).catch((err) => {
      if (index === candidates.length - 1) {
        throw new Error(err?.message || 'No working Python interpreter found for flowchart generation.');
      }
      return tryCandidate(index + 1);
    });
  };

  return tryCandidate();
};

const generateFallbackFlowchart = (code, language = 'code') => {
  const rawLines = code
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('//') && !line.startsWith('#') && !line.startsWith('/*') && !line.startsWith('*'))
    .slice(0, 24);

  const cleanedLines = rawLines.length > 0 ? rawLines : ['Process input code'];

  const sanitize = (text) =>
    text
      .replace(/\s+/g, ' ')
      .replace(/[:]/g, ' -')
      .slice(0, 72);

  const nodeDecls = [`st=>start: Start (${language})`];
  const nodeIds = [];

  cleanedLines.forEach((line, index) => {
    const lower = line.toLowerCase();
    const snippet = sanitize(line);

    if (/\bif\b|\belse if\b|\bswitch\b|\bcase\b|\?.*:/.test(lower)) {
      const id = `cond${index + 1}`;
      nodeIds.push({ id, type: 'condition' });
      nodeDecls.push(`${id}=>condition: ${snippet}`);
      return;
    }

    if (/\breturn\b|\bprint\b|console\.log|echo\s|\boutput\b/.test(lower)) {
      const id = `io${index + 1}`;
      nodeIds.push({ id, type: 'inputoutput' });
      nodeDecls.push(`${id}=>inputoutput: ${snippet}`);
      return;
    }

    const id = `op${index + 1}`;
    nodeIds.push({ id, type: 'operation' });
    nodeDecls.push(`${id}=>operation: ${snippet}`);
  });

  nodeDecls.push('e=>end: End');

  const edges = [];
  if (nodeIds.length > 0) {
    edges.push(`st->${nodeIds[0].id}`);
  } else {
    edges.push('st->e');
  }

  nodeIds.forEach((node, index) => {
    const next = nodeIds[index + 1]?.id || 'e';
    if (node.type === 'condition') {
      edges.push(`${node.id}(yes)->${next}`);
      edges.push(`${node.id}(no)->${next}`);
    } else {
      edges.push(`${node.id}->${next}`);
    }
  });

  return `${nodeDecls.join('\n')}\n\n${edges.join('\n')}`;
};

app.post('/api/flowchart', async (req, res) => {
  const { code, language } = req.body || {};

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing required field: code' });
  }

  try {
    const normalizedLanguage = (language || '').toString().toLowerCase();

    // pyflowchart parses Python. For non-Python sources, use fallback flow synthesis.
    if (normalizedLanguage && normalizedLanguage !== 'python') {
      const flowchart = generateFallbackFlowchart(code, normalizedLanguage);
      return res.json({ success: true, flowchart, fallback: true });
    }

    const flowchart = await runFlowchartGenerator(code).catch((err) => {
      console.warn('Primary flowchart generation failed, using fallback:', err?.message || err);
      return generateFallbackFlowchart(code, normalizedLanguage || 'python');
    });

    return res.json({ success: true, flowchart });
  } catch (error) {
    console.error('Flowchart generation error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unable to generate flowchart. Ensure Python and pyflowchart are installed.'
    });
  }
});

// ─── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ChatADK Express Server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Keys:   http://localhost:${PORT}/api/keys/status`);
  console.log(`   Convert: POST http://localhost:${PORT}/api/convert`);
  console.log(`   Flowchart: POST http://localhost:${PORT}/api/flowchart\n`);
});

