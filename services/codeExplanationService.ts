import { supabase } from "../supabaseClient";

export interface CodeExplanation {
  id?: string;
  user_id: string;
  language: string;
  code: string;
  explanation: string;
  timestamp: string;
}

export const codeExplanationService = {
  /**
   * Saves a code explanation to Supabase
   */
  async saveExplanation(explanation: CodeExplanation): Promise<void> {
    try {
      const { error } = await supabase
        .from('code_explanations')
        .insert({
          user_id: explanation.user_id,
          language: explanation.language,
          code: explanation.code,
          explanation: explanation.explanation,
          timestamp: explanation.timestamp || new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error("Error saving code explanation to Supabase:", error);
    }
  },

  /**
   * Fetches latest explanations for admin
   */
  async getLatestExplanations(limitCount: number = 20): Promise<CodeExplanation[]> {
    try {
      const { data, error } = await supabase
        .from('code_explanations')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limitCount);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching code explanations:", error);
      return [];
    }
  }
};
