import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config({ path: '../.env.local' });

const app = express();
const PORT = process.env.PORT || 5000;

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

  return runWith('python').catch(() => runWith('py', ['-3']));
};

app.post('/api/flowchart', async (req, res) => {
  const { code } = req.body || {};

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing required field: code' });
  }

  try {
    const flowchart = await runFlowchartGenerator(code);
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

