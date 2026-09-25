import { authedGet, authedPost } from "./serverApi";

export interface CodeExplanation {
  id?: string;
  user_id: string;
  language: string;
  code: string;
  explanation: string;
  timestamp: string;
}

/**
 * Code explanations in Supabase — server-mediated (was direct anon writes).
 * user_id is taken from the verified Firebase token on the server, so the
 * userId argument is kept only for caller compatibility.
 */
export const codeExplanationService = {
  /**
   * Saves a code explanation to Supabase
   */
  async saveExplanation(explanation: CodeExplanation): Promise<void> {
    await authedPost('/api/supabase/explanations', {
      language: explanation.language,
      code: explanation.code,
      explanation: explanation.explanation,
    });
  },

  /**
   * Fetches latest explanations for admin (server enforces admin emails)
   */
  async getLatestExplanations(limitCount: number = 20): Promise<CodeExplanation[]> {
    return authedGet<CodeExplanation>(`/api/supabase/admin/explanations?limit=${limitCount}`);
  },
};
