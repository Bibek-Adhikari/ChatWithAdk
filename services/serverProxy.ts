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

export async function proxyPost<T = unknown>(path: string, body: unknown): Promise<(ProxyResponse & { json: T }) | null> {
  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    if (!token) return null; // guests / signed out → direct-key mode
    const r = await fetch(`${API_BASE}/api/proxy${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    // 401 = server can't verify tokens yet (service-account project mismatch)
    // 404 = no server on this host (static hosting). Both → direct fallback.
    if (r.status === 401 || r.status === 404) return null;
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json: json as T };
  } catch {
    return null; // server down / unreachable → direct fallback
  }
}
