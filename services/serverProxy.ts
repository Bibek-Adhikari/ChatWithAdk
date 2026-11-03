// services/serverProxy.ts
// Proxy-first helper for PAID APIs (news, Picsart, image).
// Tries the metered server proxy (per-user daily quota, keys stay server-side).
// Returns null when the server is absent/unusable so callers can fall back
// to direct provider keys. HTTP 429 (quota exhausted) is RETURNED, never
// swallowed, so callers surface the limit instead of bypassing it.
import { auth } from './firebase';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export interface ProxyResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
}

/**
 * Direct provider keys are a development convenience only.
 *
 * In a production build the client must never talk to AI providers directly,
 * because every VITE_* value is baked into the public JavaScript bundle.
 * Set VITE_ALLOW_DIRECT_AI_KEYS=true only for a static deployment that has
 * no API server at all (the trade-off is that your keys become public).
 */
export function directFallbackAllowed(): boolean {
  const env = (import.meta as any).env || {};
  if (env.VITE_ALLOW_DIRECT_AI_KEYS === 'true') return true;
  return !!env.DEV;
}

export function aiUnavailableError(feature = 'AI'): Error {
  return new Error(
    `${feature} is temporarily unavailable. Please try again in a moment.`
  );
}

export async function proxyPost<T = unknown>(path: string, body: unknown): Promise<(ProxyResponse & { json: T }) | null> {
  try {
    // Guests are allowed: the server meters them by hashed IP instead of uid.
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(`${API_BASE}/api/proxy${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    // 404 = no server on this host (static hosting) → caller decides.
    // 401 = token rejected → caller may use the development fallback.
    if (r.status === 404 || r.status === 401) return null;
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json: json as T };
  } catch {
    return null; // server down / unreachable → caller decides
  }
}
