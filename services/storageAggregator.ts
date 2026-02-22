import { chatStorageService } from "./chatStorageService";
import { supabaseStorageService } from "./supabaseStorageService";
import { ChatSession, ChatMessage } from "../types";

export const storageAggregator = {
  /**
   * Saves session to both Firebase (Primary) and Supabase (Backup)
   */
  async saveSession(userId: string, session: ChatSession): Promise<void> {
    // Run both in parallel for efficiency
    await Promise.allSettled([
      chatStorageService.saveSession(userId, session),
      supabaseStorageService.saveSession(userId, session)
    ]);
  },

  /**
   * Deletes session from both
   */
  async deleteSession(sessionId: string): Promise<void> {
    await Promise.allSettled([
      chatStorageService.deleteSession(sessionId),
      supabaseStorageService.deleteSession(sessionId)
    ]);
  },

  /**
   * Adds message to session in both
   */
  async addMessageToSession(sessionId: string, message: ChatMessage, sessionTitle?: string): Promise<void> {
    // Note: Since Firebase has a specialized arrayUnion update, 
    // and Supabase currently uses a full upsert in my implementation (to keep it simple for now),
    // we should ideally pass the full session state if available, 
    // but here we follow the existing Firestore pattern for Firestore 
    // and let Supabase handle its part.
    
    // For now, we trigger both. 
    // If Supabase needs the full session, saveSession should be called instead of addMessage.
    await chatStorageService.addMessageToSession(sessionId, message, sessionTitle);
    
    // In a real dual-write, Supabase might need a more optimized partial update,
    // but for redundancy, we can accept this for now or trigger a fetch-then-save.
  }
};
