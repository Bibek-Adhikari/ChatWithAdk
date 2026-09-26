// server/routes/proxy.js
// Metered server-side proxy for PAID third-party APIs.
// Keys stay on the server; each Firebase-authenticated user gets a daily
// quota tracked in Firestore (collection `api_usage`). Clients call these
// endpoints first and fall back to direct keys only when the server is
// absent (static hosting) or cannot verify tokens yet.
//
// NOTE: token verification requires the service account project to match
// the web app's Firebase project. Until aligned, verifyIdToken 401s and
// clients transparently fall back to direct-key mode.
import express from 'express';
import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const router = express.Router();

// --- Quotas (per user, per day) ---
const FREE_LIMITS = { news: 20, picsart: 10, image: 10, chat: 20 };
const PRO_LIMITS = { news: 200, picsart: 100, image: 100, chat: 1000 };
const ADMIN_EMAILS = ['crazybibek4444@gmail.com', 'bibekadhikari0763@gmail.com'];

// --- Upstream hosts ---
const TOOLS_BASE = 'https://api.picsart.io/tools/1.0';
const GENAI_BASE = 'https://genai-api.picsart.io/v1';
const IMAGE_API_URL =
  process.env.VITE_IMAGE_API_URL ||
  'https://backend.buildpicoapps.com/aero/run/image-generation-api?pk=v1-Z0FBQUFBQnBmeTlUS2lZdFVCSlQzWG1BTnN6ZXlpMTh6cExGZ2ZmWi1HQ3VRblNuRHg1SW5BOG9vdzdLdWd6U3RxYWw0REtiZkNycUxBQlZUV2o4MVVzUFpIZmFiVHBwZkE9PQ==';

// Only these Picsart paths may be reached through the server key.
const ALLOWED_TOOLS_ENDPOINTS = new Set(['/removebg', '/upscale/ultra', '/enhance/face', '/smart-crop']);
const ALLOWED_GENAI_ENDPOINTS = new Set(['/painting/replace-background', '/painting/inpaint']);

const initFirebaseAdmin = () => {
  if (getApps().length > 0) return;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
    return;
  }
  initializeApp({ credential: applicationDefault() });
};

const requireFirebaseAuth = async (req, res, next) => {
  try {
    initFirebaseAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token.' });
    const decoded = await getAuth().verifyIdToken(token);
    req.firebaseUser = decoded;
    return next();
  } catch (error) {
    console.error('Proxy auth failed:', error?.message || error);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const todayStr = () => new Date().toISOString().slice(0, 10);

async function isProUser(uid, email) {
  if (email && ADMIN_EMAILS.includes(email)) return true;
  try {
    const u = await getAuth().getUser(uid);
    if (u.customClaims?.pro) return true;
  } catch { /* fall through to subscriptions doc */ }
  try {
    const snap = await getFirestore().collection('subscriptions').doc(uid).get();
    if (snap.exists && snap.data()?.status === 'active') return true;
  } catch { /* treat as free */ }
  return false;
}

// Reserve one unit of quota. Returns { ok, limit, remaining, pro }.
// Quota is reserved BEFORE the upstream call so retry-spam cannot bypass it.
async function checkAndBump(uid, email, kind) {
  const db = getFirestore();
  const ref = db.collection('api_usage').doc(uid);
  const snap = await ref.get().catch(() => null);
  const today = todayStr();
  let data = snap && snap.exists ? snap.data() : null;
  if (!data || data.date !== today) data = { date: today, news: 0, picsart: 0, image: 0, chat: 0 };
  const pro = await isProUser(uid, email);
  const limit = (pro ? PRO_LIMITS : FREE_LIMITS)[kind] ?? 10;
  const used = Number(data[kind] || 0);
  if (used >= limit) return { ok: false, limit, remaining: 0, pro };
  data[kind] = used + 1;
  await ref.set(data, { merge: true });
  return { ok: true, limit, remaining: limit - data[kind], pro };
}

const metered = (kind) => async (req, res, next) => {
  try {
    const chk = await checkAndBump(req.firebaseUser.uid, req.firebaseUser.email, kind);
    if (!chk.ok) {
      return res.status(429).json({
        error: `Daily ${kind} limit reached (${chk.limit}). Upgrade to Pro for more.`,
        limit: chk.limit,
        remaining: 0,
      });
    }
    res.set('X-Quota-Limit', String(chk.limit));
    res.set('X-Quota-Remaining', String(chk.remaining));
    req.quota = chk;
    return next();
  } catch (error) {
    console.error('Metering failed:', error?.message || error);
    return res.status(500).json({ error: 'Usage metering unavailable. Try again.' });
  }
};

const clean = (s, max = 4000) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

// Reasoning-trace extractor (mirrors services/modelThinking.ts).
// Groq gpt-oss → message.reasoning_content; OpenRouter R1 → message.reasoning
// (string or array) / message.reasoning_details. Absent → undefined.
const extractThinking = (msg) => {
  if (!msg || typeof msg !== 'object') return undefined;
  if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
    return msg.reasoning_content.trim().slice(0, 6000);
  }
  const out = [];
  const push = (v) => {
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
    else if (v && typeof v === 'object') {
      if (typeof v.text === 'string' && v.text.trim()) out.push(v.text.trim());
      else if (typeof v.summary === 'string' && v.summary.trim()) out.push(v.summary.trim());
    }
  };
  if (typeof msg.reasoning === 'string') push(msg.reasoning);
  else if (Array.isArray(msg.reasoning)) msg.reasoning.forEach(push);
  if (Array.isArray(msg.reasoning_details)) msg.reasoning_details.forEach(push);
  if (!out.length) return undefined;
  return out.join('\n\n').slice(0, 6000);
};
const normArticle = (n) => ({
  title: n.title || '',
  text: clean(`${n.title || ''}. ${n.text || n.summary || n.content || n.description || ''}`),
  url: n.url || n.link || '',
  publish_date: n.publish_date || n.pubDate || '',
});

// --- News cache: identical questions within 15 min cost zero (no quota spent) ---
const NEWS_CACHE_TTL_MS = 15 * 60 * 1000;
const newsCache = new Map(); // normalized query -> { at, articles }
const normalizeNewsQuery = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
// Stop cascading once a provider returns this many articles.
const MIN_NEWS_ARTICLES = 3;

const fetchTavilyNews = (q, key) =>
  fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query: q, search_depth: 'basic', max_results: 5, include_answer: false }),
  })
    .then((r) => (r.ok ? r.json() : { results: [] }))
    .then((d) => (d.results || []).map((x) => ({ title: x.title, text: x.content || x.snippet, url: x.url, publish_date: x.published_date })))
    .catch(() => []);

const fetchWorldNews = (q, key) =>
  fetch(`https://api.worldnewsapi.com/search-news?api-key=${key}&text=${encodeURIComponent(q)}&number=5&language=en`)
    .then((r) => (r.ok ? r.json() : { news: [] }))
    .then((d) => d.news || [])
    .catch(() => []);

const fetchNewsdataNews = (q, key, political) =>
  fetch(`https://newsdata.io/api/1/latest?apikey=${key}&q=${encodeURIComponent(q)}&language=en&size=5${political ? '&category=politics' : ''}`)
    .then((r) => (r.ok ? r.json() : { results: [] }))
    .then((d) => d.results || [])
    .catch(() => []);

// POST /api/proxy/news { q, political? }
// Cascade (credit saver): Tavily → WorldNews → NewsData, stopping at the
// first provider with >= 3 articles. Typical cost: 1 paid call per question.
router.post(
  '/news',
  requireFirebaseAuth,
  (req, res, next) => {
    const q = normalizeNewsQuery(req.body?.q);
    if (!q) return res.status(400).json({ error: 'Missing q.' });
    req.newsQuery = q;
    const hit = newsCache.get(q);
    if (hit && Date.now() - hit.at < NEWS_CACHE_TTL_MS) {
      return res.json({ articles: hit.articles, cached: true, remaining: null });
    }
    return next();
  },
  metered('news'),
  async (req, res) => {
    const q = req.newsQuery;
    const political = req.body?.political === true;
    const worldKey = process.env.VITE_WORLD_NEWS_API_KEY;
    const newsdataKey = process.env.VITE_NEWSDATA_API_KEY;
    const tavilyKey = process.env.VITE_TAVILY_API_KEY;
    if (!tavilyKey && !worldKey && !newsdataKey) {
      return res.status(500).json({ error: 'No news providers configured on server.' });
    }

    let raw = [];
    if (tavilyKey) raw = await fetchTavilyNews(q, tavilyKey);
    if (raw.length < MIN_NEWS_ARTICLES && worldKey) raw = raw.concat(await fetchWorldNews(q, worldKey));
    if (raw.length < MIN_NEWS_ARTICLES && newsdataKey) raw = raw.concat(await fetchNewsdataNews(q, newsdataKey, political));

    const articles = raw.map(normArticle).filter((a) => a.title || a.text).slice(0, 8);
    if (newsCache.size > 200) newsCache.clear();
    newsCache.set(q, { at: Date.now(), articles });
    res.json({ articles, cached: false, remaining: req.quota?.remaining ?? null });
  },
);

// --- Picsart helpers ---
const b64ToBlob = (b64, mime, name) =>
  new Blob([Buffer.from(String(b64).split(',').pop(), 'base64')], { type: mime || 'image/png' });

const extractGenaiUrl = (data) => {
  if (!data) return null;
  if (Array.isArray(data.data) && data.data[0]?.url) return data.data[0].url;
  if (data.data?.url) return data.data.url;
  return data.url || null;
};

async function pollGenaiResult(inferenceId, headers) {
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > 120000) throw new Error('AI job timed out. Try again.');
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${GENAI_BASE}/painting/${encodeURIComponent(inferenceId)}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 202) throw new Error(data.detail || data.message || `Result check failed (${res.status})`);
    const url = extractGenaiUrl(data);
    if (url) return url;
    if (data.status === 'failed' || data.status === 'error') {
      throw new Error(data.detail || data.message || 'AI job failed');
    }
  }
}

// POST /api/proxy/picsart
// { api:'tools'|'genai', endpoint, imageBase64, mime, prompt?, segment?, maskBase64?, extra? }
router.post('/picsart', requireFirebaseAuth, metered('picsart'), async (req, res) => {
  const picsartKey = process.env.VITE_PICSART_API_KEY || process.env.REACT_APP_PICSART_API_KEY;
  if (!picsartKey) return res.status(500).json({ error: 'Picsart key not configured on server.' });

  const { api, endpoint, imageBase64, mime, prompt, segment, maskBase64, maskMime, extra } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64.' });
  const headers = { 'X-Picsart-API-Key': picsartKey };

  try {
    if (api === 'genai') {
      if (!ALLOWED_GENAI_ENDPOINTS.has(endpoint)) return res.status(400).json({ error: 'Endpoint not allowed.' });
      if (!String(prompt || '').trim()) return res.status(400).json({ error: 'Prompt required.' });
      const fd = new FormData();
      fd.append('image', b64ToBlob(imageBase64, mime), 'image.png');
      fd.append('prompt', String(prompt).trim());
      fd.append('count', '1');
      fd.append('format', 'JPG');
      if (maskBase64) fd.append('mask_image', b64ToBlob(maskBase64, maskMime || mime), 'mask.png');
      const jobRes = await fetch(`${GENAI_BASE}${endpoint}`, { method: 'POST', headers, body: fd });
      const job = await jobRes.json().catch(() => ({}));
      if (!jobRes.ok) return res.status(jobRes.status).json({ error: job.detail || job.message || `Picsart error (${jobRes.status})` });
      let url = extractGenaiUrl(job);
      const inferenceId = job.inference_id || job.transaction_id;
      if (!url && inferenceId) url = await pollGenaiResult(inferenceId, headers);
      if (!url) return res.status(502).json({ error: 'No image returned from Picsart.' });
      return res.json({ url, remaining: req.quota?.remaining ?? null });
    }

    // tools (sync) flow
    if (!ALLOWED_TOOLS_ENDPOINTS.has(endpoint)) return res.status(400).json({ error: 'Endpoint not allowed.' });
    const fd = new FormData();
    fd.append('image', b64ToBlob(imageBase64, mime), 'image.png');
    if (endpoint === '/removebg') fd.append('output_type', 'cutout');
    if (endpoint === '/upscale/ultra') fd.append('upscale_factor', '2');
    if (endpoint === '/smart-crop') fd.append('segment', String(segment || prompt || 'foreground').trim() || 'foreground');
    else if (extra && typeof extra === 'object') {
      for (const [k, v] of Object.entries(extra)) fd.append(k, String(v));
    }
    const r = await fetch(`${TOOLS_BASE}${endpoint}`, { method: 'POST', headers, body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: data.detail || data.message || `Picsart error (${r.status})` });
    const url = data?.data?.url || data?.data?.image_url || data?.url;
    if (!url) return res.status(502).json({ error: 'No image returned from Picsart.' });
    return res.json({ url, remaining: req.quota?.remaining ?? null });
  } catch (error) {
    console.error('Picsart proxy error:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Picsart request failed.' });
  }
});

// POST /api/proxy/image { prompt }
router.post('/image', requireFirebaseAuth, metered('image'), async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });
  try {
    const r = await fetch(IMAGE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: data.message || `Image API error (${r.status})` });
    if (data.status === 'success' && data.imageUrl) {
      return res.json({ imageUrl: data.imageUrl, remaining: req.quota?.remaining ?? null });
    }
    return res.status(502).json({ error: data.message || 'Failed to generate image.' });
  } catch (error) {
    console.error('Image proxy error:', error?.message || error);
    return res.status(500).json({ error: 'Image request failed.' });
  }
});

// --- Chat proxy config ---
// Model allowlist: clients may only spend server quota on these exact models.
const ALLOWED_CHAT_MODELS = new Set(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'deepseek/deepseek-r1']);
// All 33 CodeCraft models verified live (each answered a probe completion).
const CODECRAFT_MODELS = new Set([
  'muse-spark-1.1', 'gemma-2-2b', 'gpt-5.6-sol', 'claude-opus-5', 'claude-fable-5',
  'claude-mythos-preview', 'kimi-k3', 'glm-5.3', 'deepseek-v4-pro-0813', 'qwen3.8-max',
  'gpt-5.6-terra', 'claude-opus-4.8', 'gemini-3.7-flash', 'claude-sonnet-5', 'gpt-5.5',
  'grok-4.5', 'deepseek-v4-flash-0731', 'grok-4.6', 'seed-2.1-pro', 'glm-5.2',
  'qwen3.8-27b', 'gpt-5.6-luna', 'qwen3.7-max', 'claude-opus-4.6', 'gpt-5.5-pro',
  'claude-opus-4.7', 'gemini-3.6-flash', 'kimi-k2.6', 'seed-2.1-turbo', 'gemini-3.1-pro',
  'deepseek-v4-pro-max', 'claude-fable-5.1', 'claude-opus-5.5',
]);
const CODECRAFT_BASE_URL = process.env.VITE_CODECRAFT_BASE_URL || 'https://codecraftapi.com/v1';
const GEMINI_FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro-latest', 'gemini-flash-lite-latest'];
const CHAT_MAX_TOKENS = 4096;

// POST /api/proxy/chat { engine:'groq'|'research'|'openrouter'|'gemini', ... }
// Metered chat completions — keys stay server-side, per-user daily quota.
router.post('/chat', requireFirebaseAuth, metered('chat'), async (req, res) => {
  const { engine, messages, history, prompt, image, model, temperature, max_tokens } = req.body || {};
  const remaining = req.quota?.remaining ?? null;

  try {
    if (engine === 'groq' || engine === 'research' || engine === 'openrouter') {
      const chatModel = String(model || '');
      if (!ALLOWED_CHAT_MODELS.has(chatModel)) return res.status(400).json({ error: 'Model not allowed.' });
      if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Missing messages.' });

      const isOpenRouter = engine !== 'groq';
      const key = isOpenRouter ? process.env.VITE_OPENROUTER_API_KEY : process.env.VITE_GROQ_API_KEY;
      if (!key) return res.status(500).json({ error: 'Chat provider key not configured on server.' });

      const url = isOpenRouter
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : 'https://api.groq.com/openai/v1/chat/completions';
      const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
      if (isOpenRouter) {
        headers['HTTP-Referer'] = 'https://chatwithadk.com';
        headers['X-Title'] = 'ChatWithAdk';
      }
      const r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: chatModel,
          messages,
          temperature: typeof temperature === 'number' ? temperature : 0.7,
          max_tokens: Math.min(Number(max_tokens) || CHAT_MAX_TOKENS, CHAT_MAX_TOKENS),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status).json({ error: data.error?.message || `Chat provider error (${r.status})` });
      const msg = data.choices?.[0]?.message || {};
      const text = msg.content || '';
      const thinking = extractThinking(msg);
      return res.json({ text, thinking, remaining });
    }

    if (engine === 'codecraft') {
      const chatModel = String(model || '');
      if (!CODECRAFT_MODELS.has(chatModel)) return res.status(400).json({ error: 'Model not allowed.' });
      if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Missing messages.' });
      const key = process.env.VITE_CODECRAFT_API_KEY;
      if (!key) return res.status(500).json({ error: 'CodeCraft key not configured on server.' });
      const r = await fetch(`${CODECRAFT_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chatModel,
          messages,
          temperature: typeof temperature === 'number' ? temperature : 0.7,
          max_tokens: Math.min(Number(max_tokens) || CHAT_MAX_TOKENS, CHAT_MAX_TOKENS),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status).json({ error: data.error?.message || `CodeCraft error (${r.status})` });
      const msg = data.choices?.[0]?.message || {};
      return res.json({ text: msg.content || '', thinking: extractThinking(msg), remaining });
    }

    // Gemini (default): history in {role, parts[]} shape + prompt + optional image
    const geminiKey = process.env.VITE_GEMINI_API_KEY;
    if (!geminiKey) return res.status(500).json({ error: 'Gemini key not configured on server.' });
    const parts = [{ text: String(prompt || '') }];
    if (image?.data) parts.push({ inlineData: { data: image.data, mimeType: image.mimeType || 'image/jpeg' } });
    const contents = [
      ...(Array.isArray(history) ? history : []),
      { role: 'user', parts },
    ];
    let lastErr = 'Gemini request failed.';
    for (const m of GEMINI_FALLBACK_MODELS) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: typeof temperature === 'number' ? temperature : 0.7 },
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        if (text) return res.json({ text, remaining });
        lastErr = 'Empty response from Gemini.';
      } else {
        lastErr = data.error?.message || `Gemini error (${r.status})`;
        if (r.status === 400 || r.status === 403) break; // key/permission issue — no point trying more models
      }
    }
    return res.status(502).json({ error: lastErr });
  } catch (error) {
    console.error('Chat proxy error:', error?.message || error);
    return res.status(500).json({ error: 'Chat request failed.' });
  }
});

// GET /api/proxy/quota — current user's daily usage (for UI display)
router.get('/quota', requireFirebaseAuth, async (req, res) => {
  try {
    initFirebaseAdmin();
    const uid = req.firebaseUser.uid;
    const db = getFirestore();
    const snap = await db.collection('api_usage').doc(uid).get().catch(() => null);
    const today = todayStr();
    const usage = snap && snap.exists && snap.data()?.date === today
      ? { news: 0, picsart: 0, image: 0, chat: 0, ...snap.data() }
      : { date: today, news: 0, picsart: 0, image: 0, chat: 0 };
    const pro = await isProUser(uid, req.firebaseUser.email);
    const limits = pro ? PRO_LIMITS : FREE_LIMITS;
    res.json({ date: today, pro, limits, used: { news: usage.news || 0, picsart: usage.picsart || 0, image: usage.image || 0, chat: usage.chat || 0 } });
  } catch (error) {
    res.status(500).json({ error: 'Quota lookup failed.' });
  }
});

export default router;
