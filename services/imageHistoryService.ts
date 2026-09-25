import { authedGet, authedPost } from "./serverApi";

export interface ImageJob {
  id?: string;
  user_id?: string;
  tool: string;
  prompt: string;
  output_url?: string | null;
  status?: string;
  created_at?: string;
}

/**
 * Per-user history of every PhotoAdk tool run, stored in Supabase via the
 * verified server gateway (Firebase UID comes from the ID token).
 * Fire-and-forget: logging must never break the editing flow.
 */
export const imageHistoryService = {
  async logImageJob(job: { tool: string; prompt?: string; outputUrl?: string | null; status?: 'complete' | 'error' }): Promise<void> {
    await authedPost('/api/supabase/image-jobs', {
      tool: job.tool,
      prompt: job.prompt || '',
      outputUrl: job.outputUrl ?? null,
      status: job.status || 'complete',
    });
  },

  async getImageJobs(limit = 50): Promise<ImageJob[]> {
    return authedGet<ImageJob>(`/api/supabase/image-jobs?limit=${limit}`);
  },
};
