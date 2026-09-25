import { ChatSession } from "../types";
import { authedFetch, authedGet, authedPost } from "./serverApi";

/**
 * Chat backup in Supabase — now fully server-mediated.
 *
 * Old behavior: the browser wrote straight to Supabase with the anon key and
 * a self-reported user_id (no verification). New behavior: every call goes to
 * the Express gateway, which verifies the Firebase ID token and uses the
 * service-role key. Same method names, so callers (storageAggregator, admin
 * dashboard) are unchanged. Guests (no Firebase user) silently skip backup.
 */
export const supabaseStorageService = {
  /**
   * Saves or updates a chat session in Supabase (verified backup).
   */
  async saveSession(userId: string, session: ChatSession): Promise<void> {
    await authedPost('/api/supabase/chat/sessions', {
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      messages: (session.messages || []).map((msg) => ({
        role: msg.role,
        parts: msg.parts,
        timestamp: msg.timestamp,
        modelId: msg.modelId,
      })),
    });
  },

  /**
   * Deletes a specific session from Supabase (scoped to the verified user).
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const res = await authedFetch(`/api/supabase/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      if (!res || !res.ok) {
        throw new Error((res && (await res.text().catch(() => ''))) || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting session from Supabase:', error);
    }
  },

  /**
   * Fetches latest sessions for admin view (server enforces admin emails).
   */
  async getAllSessionsForAdmin(): Promise<any[]> {
    return authedGet<any>('/api/supabase/admin/sessions?limit=100');
  },
};
