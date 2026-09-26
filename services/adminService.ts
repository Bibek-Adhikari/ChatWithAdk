import { authedFetch, authedGet, authedPost } from "./serverApi";

export interface ModelConfig {
  fast: 'groq' | 'gemini' | 'research' | 'openrouter';
  research: 'groq' | 'gemini' | 'research' | 'openrouter';
  detail: 'groq' | 'gemini' | 'research' | 'openrouter';
  imagine: 'imagine';
  motion: 'motion';
}

const DEFAULT_CONFIG: ModelConfig = {
  fast: 'groq',
  research: 'research',
  detail: 'gemini',
  imagine: 'imagine',
  motion: 'motion'
};

/**
 * Admin data access — fully server-mediated via the Firebase Admin SDK.
 *
 * Why: firestore.rules denies ALL client writes to users/{uid} and
 * system/*, and denies cross-user reads, so the old direct setDoc/getDocs
 * calls silently failed on every login. These methods now hit Express
 * endpoints that verify the Firebase ID token and use the Admin SDK
 * (which bypasses rules). Callers are unchanged.
 */
export const adminService = {
  /**
   * Syncs user profile to Firestore for admin tracking (Admin SDK write).
   */
  async syncUser(user: { uid: string }): Promise<void> {
    await authedPost('/api/admin/sync-user', {});
  },

  /**
   * Fetches latest registered users (Admin only, enforced server-side).
   */
  async getLatestUsers(limitCount: number = 10): Promise<any[]> {
    return authedGet<any>(`/api/admin/users?limit=${limitCount}`);
  },

  /**
   * Fetches system-wide stats (Admin only, enforced server-side).
   */
  async getSystemStats(): Promise<{ totalUsers: number; totalSessions: number }> {
    try {
      const res = await authedFetch('/api/admin/stats');
      if (!res || !res.ok) return { totalUsers: 0, totalSessions: 0 };
      const payload = await res.json().catch(() => null);
      return {
        totalUsers: Number(payload?.data?.totalUsers) || 0,
        totalSessions: Number(payload?.data?.totalSessions) || 0,
      };
    } catch (error) {
      console.error("Error fetching stats:", error);
      return { totalUsers: 0, totalSessions: 0 };
    }
  },

  /**
   * Fetches the system model configuration (any signed-in user).
   */
  async getModelConfig(): Promise<ModelConfig> {
    try {
      const res = await authedFetch('/api/admin/model-config');
      if (!res || !res.ok) return DEFAULT_CONFIG;
      const payload = await res.json().catch(() => null);
      return { ...DEFAULT_CONFIG, ...(payload?.data || {}) } as ModelConfig;
    } catch (error) {
      console.error("Error fetching model config:", error);
      return DEFAULT_CONFIG;
    }
  },

  /**
   * Updates the system model configuration (Admin only, enforced server-side).
   */
  async updateModelConfig(config: Partial<ModelConfig>): Promise<void> {
    const res = await authedFetch('/api/admin/model-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    if (!res || !res.ok) {
      const raw = res ? await res.text().catch(() => '') : 'Not signed in';
      throw new Error(raw || 'Failed to save configuration');
    }
  },
};
