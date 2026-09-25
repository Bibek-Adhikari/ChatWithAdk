// services/apiHealthService.ts
// Central catalogue of every external API the app depends on:
// live status checks (free endpoints only run automatically),
// credit/quota info where the provider exposes it, and what each
// API powers in the UI. Never logs or returns full key values.

export type ApiStatus = 'online' | 'offline' | 'unknown' | 'unconfigured';
export type CheckCost = 'free' | 'paid' | 'none';

export interface ApiDef {
  id: string;
  name: string;
  icon: string; // font-awesome class
  envKeys: string[]; // env names holding this API's credentials (masked in UI)
  powers: string[]; // what this API makes possible in the app
  dashboard: string; // provider console URL
  quotaNote: string; // human-readable quota/plan note
  cost: CheckCost; // what a live check costs
}

export interface HealthResult {
  status: ApiStatus;
  detail: string;
  credits?: string; // e.g. "29 credits left"
  usedPct?: number | null; // 0-100 when the provider exposes usage numbers
  checkedAt: number;
}

export const API_DEFS: ApiDef[] = [
  {
    id: 'gemini', name: 'Google Gemini', icon: 'fa-sparkles',
    envKeys: ['VITE_GEMINI_API_KEY'],
    powers: ['Detail chat mode', 'YouTube video summaries', 'Default fallback engine', 'Image + text (multimodal) input'],
    dashboard: 'https://aistudio.google.com/app/apikey',
    quotaNote: 'AI Studio free tier ≈ 1,500 req/day (model-dependent)',
    cost: 'free',
  },
  {
    id: 'groq', name: 'Groq (Fast)', icon: 'fa-bolt',
    envKeys: ['VITE_GROQ_API_KEY'],
    powers: ['Flash chat mode', 'Fast low-latency answers', 'Fallback for code explainer + converter'],
    dashboard: 'https://console.groq.com/keys',
    quotaNote: 'Free tier ≈ 14,400 req/day on openai/gpt-oss-120b',
    cost: 'free',
  },
  {
    id: 'explainer', name: 'Groq (Explainer)', icon: 'fa-code',
    envKeys: ['VITE_EXPLAINER_API_KEY'],
    powers: ['ConverterAdk smart-convert', 'CodeAdk “Explain with AI” button'],
    dashboard: 'https://console.groq.com/keys',
    quotaNote: 'Separate key so code tools never eat chat quota',
    cost: 'free',
  },
  {
    id: 'openrouter', name: 'OpenRouter', icon: 'fa-microscope',
    envKeys: ['VITE_OPENROUTER_API_KEY'],
    powers: ['Reasoning / Research mode (DeepSeek R1)', 'Admin-remappable research engine'],
    dashboard: 'https://openrouter.ai/settings/keys',
    quotaNote: '% used is computed from the key endpoint when the provider reports a limit',
    cost: 'free',
  },
  {
    id: 'youtube', name: 'YouTube Data', icon: 'fa-play',
    envKeys: ['VITE_YOUTUBE_API_KEY'],
    powers: ['/youtube command search', 'Auto video cards in answers', 'Direct-URL video details'],
    dashboard: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
    quotaNote: '10,000 units/day — 1 unit per check, 100 per search',
    cost: 'paid',
  },
  {
    id: 'firebase', name: 'Firebase (Auth + DB)', icon: 'fa-fire',
    envKeys: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID'],
    powers: ['Google + email login', 'Firestore users / sessions / config', 'Pro-claim gating', 'Admin stats'],
    dashboard: 'https://console.firebase.google.com/',
    quotaNote: 'Spark plan: 50k reads / 20k writes per day',
    cost: 'free',
  },
  {
    id: 'worldnews', name: 'World News API', icon: 'fa-globe',
    envKeys: ['VITE_WORLD_NEWS_API_KEY'],
    powers: ['2025–2026 news grounding in chat', 'Politics / current-event answers'],
    dashboard: 'https://worldnewsapi.com/',
    quotaNote: 'Paid per request — free tier is tiny, check console',
    cost: 'paid',
  },
  {
    id: 'newsdata', name: 'NewsData.io', icon: 'fa-newspaper',
    envKeys: ['VITE_NEWSDATA_API_KEY'],
    powers: ['News grounding fallback', 'Politics-category answers'],
    dashboard: 'https://newsdata.io/dashboard',
    quotaNote: 'Paid per credit — 1 credit per test call',
    cost: 'paid',
  },
  {
    id: 'tavily', name: 'Tavily Search', icon: 'fa-magnifying-glass',
    envKeys: ['VITE_TAVILY_API_KEY'],
    powers: ['Real-time web search grounding', 'Freshest 2026 facts in answers'],
    dashboard: 'https://app.tavily.com/home',
    quotaNote: 'Paid per search — 1 credit per test call',
    cost: 'paid',
  },
  {
    id: 'picsart', name: 'Picsart (Photo tools)', icon: 'fa-image',
    envKeys: ['VITE_PICSART_API_KEY'],
    powers: ['Background remover', 'Ultra upscale', 'Face retouch', 'AI background', 'Smart replace', 'Smart crop'],
    dashboard: 'https://console.picsart.io/',
    quotaNote: 'Balance endpoint is free; each edit burns credits. Plan total is not exposed, so % is n/a.',
    cost: 'free',
  },
  {
    id: 'supabase', name: 'Supabase (Backup DB)', icon: 'fa-database',
    envKeys: ['VITE_APP_SUPABASE_URL', 'VITE_APP_SUPABASE_ANON_KEY'],
    powers: ['Chat backup (sessions/messages)', 'Code-explanation log', 'Converter history API', 'Admin history tables'],
    dashboard: 'https://supabase.com/dashboard/project/_/settings/api',
    quotaNote: 'Free tier pauses when idle — 502/521 means “still waking up”',
    cost: 'free',
  },
  {
    id: 'stripe', name: 'Stripe (Payments)', icon: 'fa-credit-card',
    envKeys: ['VITE_STRIPE_PUBLIC_KEY', 'STRIPE_SECRET_KEY'],
    powers: ['Plans checkout', 'Pro / Enterprise subscriptions', 'Pro-claim activation via webhook'],
    dashboard: 'https://dashboard.stripe.com/test/dashboard',
    quotaNote: 'No client-side health check — verify in the Stripe dashboard (test mode)',
    cost: 'none',
  },
  {
    id: 'edgeTts', name: 'Edge TTS (Voice)', icon: 'fa-microphone',
    envKeys: ['VITE_EDGE_TTS_URL'],
    powers: ['Read-aloud answers', 'Voice library picker'],
    dashboard: 'https://huggingface.co/spaces/bibekadk-chatadk/chatadk',
    quotaNote: 'Self-hosted HF Space — sleeps when idle, first call wakes it',
    cost: 'free',
  },
  {
    id: 'imagine', name: 'Imagine (Image gen)', icon: 'fa-wand-magic-sparkles',
    envKeys: ['VITE_IMAGE_API_URL'],
    powers: ['Imagine mode pictures', '/image command in chat'],
    dashboard: 'https://buildpicoapps.com/',
    quotaNote: 'Third-party demo key — no health endpoint; test via Imagine mode',
    cost: 'none',
  },
];

const env = (name: string): string => {
  try {
    return (import.meta as any).env?.[name] || '';
  } catch {
    return '';
  }
};

/** Masked preview for admin display, e.g. "AIza...Ouhw". Never returns the full key. */
export function maskedKey(...names: string[]): string {
  for (const n of names) {
    const v = env(n);
    if (v) return v.length > 8 ? `${v.slice(0, 4)}...${v.slice(-4)}` : v.slice(0, 2) + '***';
  }
  return '(missing)';
}

export function isConfigured(def: ApiDef): boolean {
  return def.envKeys.some((k) => env(k).trim().length > 0);
}

/** Stripe placeholder values (pk_live_... etc.) count as NOT configured. */
export function isPlaceholder(value: string): boolean {
  return /^(pk|sk|whsec)_(live|test)_\.\.\.$/.test(value.trim()) || value.trim().length < 12;
}

async function withTimeout(ms = 12000): Promise<{ signal: AbortSignal; done: () => void }> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

const now = () => Date.now();

async function checkGroqLike(keyName: string): Promise<HealthResult> {
  const key = env(keyName);
  if (!key) return { status: 'unconfigured', detail: 'Key missing in .env', checkedAt: now() };
  const { signal, done } = await withTimeout();
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` }, signal,
    });
    const t = await r.text();
    done();
    if (r.ok) return { status: 'online', detail: `${JSON.parse(t).data?.length ?? '?'} models visible`, checkedAt: now() };
    if (r.status === 401) return { status: 'offline', detail: 'Invalid / revoked key (401)', checkedAt: now() };
    return { status: 'unknown', detail: `HTTP ${r.status}`, checkedAt: now() };
  } catch (e: any) {
    done();
    return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out' : 'Network error', checkedAt: now() };
  }
}

export async function checkApi(id: string): Promise<HealthResult> {
  const def = API_DEFS.find((d) => d.id === id);
  if (!def) return { status: 'unknown', detail: 'Unknown API', checkedAt: now() };
  if (!isConfigured(def)) return { status: 'unconfigured', detail: 'Key missing in .env', checkedAt: now() };

  switch (id) {
    case 'gemini': {
      const { signal, done } = await withTimeout();
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env('VITE_GEMINI_API_KEY')}`, { signal });
        const t = await r.text();
        done();
        if (r.ok) {
          let n = '?';
          try { n = String(JSON.parse(t).models?.length ?? '?'); } catch { /* keep ? */ }
          return { status: 'online', detail: `${n} models visible`, checkedAt: now() };
        }
        return { status: r.status === 400 ? 'offline' : 'unknown', detail: t.slice(0, 120) || `HTTP ${r.status}`, checkedAt: now() };
      } catch (e: any) {
        done();
        return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out' : 'Network error', checkedAt: now() };
      }
    }
    case 'groq':
      return checkGroqLike('VITE_GROQ_API_KEY');
    case 'explainer':
      return checkGroqLike('VITE_EXPLAINER_API_KEY');
    case 'openrouter': {
      const { signal, done } = await withTimeout();
      try {
        const r = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${env('VITE_OPENROUTER_API_KEY')}` }, signal,
        });
        const t = await r.text();
        done();
        if (!r.ok) {
          return { status: r.status === 401 ? 'offline' : 'unknown', detail: t.slice(0, 120) || `HTTP ${r.status}`, checkedAt: now() };
        }
        let credits: string | undefined;
        let usedPct: number | null = null;
        try {
          const d = JSON.parse(t).data || {};
          if (typeof d.limit === 'number' && d.limit > 0) {
            const remaining = typeof d.limit_remaining === 'number' ? d.limit_remaining : null;
            credits = remaining !== null ? `${remaining} / ${d.limit} left` : `limit ${d.limit}`;
            if (remaining !== null) usedPct = Math.max(0, Math.min(100, ((d.limit - remaining) / d.limit) * 100));
          } else if (typeof d.usage === 'number') {
            credits = `used ${d.usage}`;
          }
        } catch { /* ignore parse issues */ }
        return { status: 'online', detail: 'Key valid', credits, usedPct, checkedAt: now() };
      } catch (e: any) {
        done();
        return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out' : 'Network error', checkedAt: now() };
      }
    }
    case 'youtube': {
      const { signal, done } = await withTimeout();
      try {
        const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${env('VITE_YOUTUBE_API_KEY')}`, { signal });
        const t = await r.text();
        done();
        if (r.ok) return { status: 'online', detail: 'Videos endpoint OK (≈1 quota unit)', checkedAt: now() };
        return { status: r.status === 400 ? 'offline' : 'unknown', detail: t.slice(0, 120) || `HTTP ${r.status}`, checkedAt: now() };
      } catch (e: any) {
        done();
        return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out' : 'Network error', checkedAt: now() };
      }
    }
    case 'firebase': {
      const { signal, done } = await withTimeout();
      try {
        const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env('VITE_FIREBASE_API_KEY')}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal,
        });
        const t = await r.text();
        done();
        if (t.includes('API key not valid') || t.includes('API_KEY_INVALID')) {
          return { status: 'offline', detail: 'API key rejected by Google', checkedAt: now() };
        }
        return { status: 'online', detail: `Key accepted (${env('VITE_FIREBASE_PROJECT_ID') || 'project?'})`, checkedAt: now() };
      } catch (e: any) {
        done();
        return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out' : 'Network error', checkedAt: now() };
      }
    }
    case 'worldnews': {
      const { signal, done } = await withTimeout();
      try {
        const r = await fetch(`https://api.worldnewsapi.com/search-news?api-key=${env('VITE_WORLD_NEWS_API_KEY')}&text=test&number=1&language=en`, { signal });
        const t = await r.text();
        done();
        if (r.ok) return { status: 'online', detail: 'Search OK (1 paid call)', checkedAt: now() };
        return { status: r.status === 401 || r.status === 402 ? 'offline' : 'unknown', detail: t.slice(0, 120) || `HTTP ${r.status}`, checkedAt: now() };
      } catch (e: any) {
        done();
        return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out' : 'Network error', checkedAt: now() };
      }
    }
    case 'newsdata': {
      const { signal, done } = await withTimeout();
      try {
        const r = await fetch(`https://newsdata.io/api/1/latest?apikey=${env('VITE_NEWSDATA_API_KEY')}&q=test&language=en&size=1`, { signal });
        const t = await r.text();
        done();
        let ok = r.ok;
        try { ok = ok && JSON.parse(t).status === 'success'; } catch { /* keep */ }
        if (ok) return { status: 'online', detail: 'Latest OK (1 paid credit)', checkedAt: now() };
        return { status: 'offline', detail: t.slice(0, 120) || `HTTP ${r.status}`, checkedAt: now() };
      } catch (e: any) {
        done();
        return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out' : 'Network error', checkedAt: now() };
      }
    }
    case 'tavily': {
      const { signal, done } = await withTimeout();
      try {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: env('VITE_TAVILY_API_KEY'), query: 'test', max_results: 1, include_answer: false }),
          signal,
        });
        const t = await r.text();
        done();
        if (r.ok) return { status: 'online', detail: 'Search OK (1 paid credit)', checkedAt: now() };
        return { status: r.status === 401 ? 'offline' : 'unknown', detail: t.slice(0, 120) || `HTTP ${r.status}`, checkedAt: now() };
      } catch (e: any) {
        done();
        return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out' : 'Network error', checkedAt: now() };
      }
    }
    case 'picsart': {
      const { signal, done } = await withTimeout();
      try {
        const r = await fetch('https://api.picsart.io/tools/1.0/balance', {
          headers: { 'X-Picsart-API-Key': env('VITE_PICSART_API_KEY') }, signal,
        });
        const t = await r.text();
        done();
        if (r.ok) {
          let credits = 'balance OK';
          try {
            const c = JSON.parse(t).credits;
            if (typeof c === 'number') credits = `${c} credits left`;
          } catch { /* keep */ }
          return { status: 'online', detail: 'Key valid (free check)', credits, usedPct: null, checkedAt: now() };
        }
        return { status: r.status === 401 || r.status === 403 ? 'offline' : 'unknown', detail: t.slice(0, 120) || `HTTP ${r.status}`, checkedAt: now() };
      } catch (e: any) {
        done();
        return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out' : 'Network error', checkedAt: now() };
      }
    }
    case 'supabase': {
      const url = (env('VITE_APP_SUPABASE_URL') || env('SUPABASE_URL')).replace(/\/+$/, '');
      const anon = env('VITE_APP_SUPABASE_ANON_KEY');
      if (!url || !anon) return { status: 'unconfigured', detail: 'URL or anon key missing', checkedAt: now() };
      const { signal, done } = await withTimeout();
      try {
        const r = await fetch(`${url}/auth/v1/health`, {
          headers: { apikey: anon, Authorization: `Bearer ${anon}` }, signal,
        });
        const t = await r.text();
        done();
        if (r.ok) return { status: 'online', detail: 'Auth service healthy', checkedAt: now() };
        if (r.status === 502 || r.status === 521 || r.status === 503) {
          return { status: 'unknown', detail: `Project waking up (HTTP ${r.status}) — retry in a minute`, checkedAt: now() };
        }
        return { status: 'unknown', detail: t.slice(0, 120) || `HTTP ${r.status}`, checkedAt: now() };
      } catch (e: any) {
        done();
        const msg = String(e?.message || '');
        if (msg.includes('ENOTFOUND') || msg.includes('Failed to fetch') || msg.includes('fetch failed')) {
          return { status: 'offline', detail: 'DNS unresolvable — project paused or deleted', checkedAt: now() };
        }
        return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out' : 'Network error', checkedAt: now() };
      }
    }
    case 'stripe': {
      const pub = env('VITE_STRIPE_PUBLIC_KEY');
      const sec = env('STRIPE_SECRET_KEY');
      if (!pub || !sec || isPlaceholder(pub) || isPlaceholder(sec)) {
        return { status: 'unconfigured', detail: 'Placeholder keys — add real test keys', checkedAt: now() };
      }
      return { status: 'unknown', detail: 'Keys present — verify live in Stripe dashboard (server-side)', checkedAt: now() };
    }
    case 'edgeTts': {
      const base = (env('VITE_EDGE_TTS_URL') || 'https://bibekadk-chatadk.hf.space').replace(/\/+$/, '');
      const { signal, done } = await withTimeout(8000);
      try {
        const r = await fetch(`${base}/voices`, { cache: 'no-store', signal });
        const t = await r.text();
        done();
        if (r.ok) {
          let n: string | null = null;
          try {
            const d = JSON.parse(t);
            if (Array.isArray(d)) n = `${d.length} voices`;
          } catch { /* keep */ }
          return { status: 'online', detail: n ? `${n} available` : 'Reachable', checkedAt: now() };
        }
        return { status: 'unknown', detail: `HTTP ${r.status} — Space may be waking`, checkedAt: now() };
      } catch (e: any) {
        done();
        return { status: 'unknown', detail: e?.name === 'AbortError' ? 'Timed out — Space may be asleep' : 'Unreachable — Space may be asleep', checkedAt: now() };
      }
    }
    case 'imagine': {
      const custom = env('VITE_IMAGE_API_URL');
      return {
        status: 'unknown',
        detail: custom ? 'Custom URL set — test via Imagine mode' : 'Built-in demo key — test via Imagine mode',
        checkedAt: now(),
      };
    }
    default:
      return { status: 'unknown', detail: 'No checker yet', checkedAt: now() };
  }
}
