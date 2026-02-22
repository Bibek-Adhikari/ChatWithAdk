import { supabase } from "../supabaseClient";
import { ChatSession, ChatMessage } from "../types";

export const supabaseStorageService = {
  /**
   * Saves or updates a chat session in Supabase
   */
  async saveSession(userId: string, session: ChatSession): Promise<void> {
    try {
      // 1. Upsert the session metadata
      const { error: sessionError } = await supabase
        .from('sessions')
        .upsert({
          id: session.id,
          user_id: userId,
          title: session.title,
          updated_at: new Date(session.updatedAt).toISOString()
        });

      if (sessionError) throw sessionError;

      // 2. Clear existing messages for this session and re-insert 
      // (Simple strategy for secondary backup)
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('session_id', session.id);

      if (deleteError) throw deleteError;

      if (session.messages.length > 0) {
        const messagesToInsert = session.messages.map(msg => ({
          session_id: session.id,
          role: msg.role,
          parts: msg.parts, // JSONB column
          timestamp: msg.timestamp,
          model_id: msg.modelId
        }));

        const { error: messageError } = await supabase
          .from('messages')
          .insert(messagesToInsert);

        if (messageError) throw messageError;
      }
    } catch (error) {
      console.error("Error saving session to Supabase:", error);
      // We don't throw here to avoid breaking the primary firebase flow
    }
  },

  /**
   * Deletes a specific session from Supabase
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      // cascade delete should handle messages if foreign keys are set, 
      // but we do it manually to be safe
      await supabase.from('messages').delete().eq('session_id', sessionId);
      await supabase.from('sessions').delete().eq('id', sessionId);
    } catch (error) {
      console.error("Error deleting session from Supabase:", error);
    }
  },

  /**
   * Fetches latest sessions for admin view
   */
  async getAllSessionsForAdmin(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          messages (count)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching admin sessions:", error);
      return [];
    }
  }
};
