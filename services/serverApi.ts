import { auth } from "./firebase";

/**
 * Authenticated fetch against our own Express server.
 *
 * Attaches the current Firebase user's ID token as a Bearer token so the
 * server can verify identity (Firebase Admin SDK) before touching Supabase
 * with the service-role key. The browser never sees any Supabase key.
 *
 * Returns null when there is no signed-in user (guest) — callers should
 * treat that as "backup unavailable" and keep the local/Firestore flow.
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return null;

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(path, { ...init, headers });
}

/** GET helper that returns the parsed `data` array (or [] on any failure). */
export async function authedGet<T>(path: string): Promise<T[]> {
  try {
    const res = await authedFetch(path);
    if (!res || !res.ok) return [];
    const payload = await res.json().catch(() => null);
    return (payload?.data || []) as T[];
  } catch (err) {
    console.error(`Server GET ${path} failed:`, err);
    return [];
  }
}

/** POST helper. Resolves false when logged out or on any failure (backup only). */
export async function authedPost(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await authedFetch(path, { method: 'POST', body: JSON.stringify(body) });
    if (!res || !res.ok) {
      const raw = res ? await res.text().catch(() => '') : 'logged out';
      throw new Error(raw || 'Server gateway error');
    }
    return true;
  } catch (err) {
    console.error(`Server POST ${path} failed:`, err);
    return false;
  }
}
