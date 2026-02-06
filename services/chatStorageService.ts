import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  updateDoc,
  Timestamp,
  getDoc,
  arrayUnion,
  onSnapshot
} from "firebase/firestore";
import { db } from "./firebase";
import { ChatSession, ChatMessage } from "../types";

const SESSIONS_COLLECTION = "sessions";

export const chatStorageService = {
  /**
   * Saves or updates a chat session in Firestore
   */
  async saveSession(userId: string, session: ChatSession): Promise<void> {
    try {
      const sessionRef = doc(db, SESSIONS_COLLECTION, session.id);
      
      // We store the userId inside the document for easy filtering
      await setDoc(sessionRef, {
        ...session,
        userId,
        updatedAt: Timestamp.fromMillis(session.updatedAt),
        // Convert ISO timestamps if needed, but keeping them as strings is fine for messages
      }, { merge: true });
    } catch (error) {
      console.error("Error saving session to Firestore:", error);
      throw error;
    }
  },

  /**
   * Fetches all chat sessions for a specific user
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    try {
      const q = query(
        collection(db, SESSIONS_COLLECTION),
        where("userId", "==", userId)
      );
      
      const querySnapshot = await getDocs(q);
      const sessions: ChatSession[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        sessions.push({
          id: data.id,
          title: data.title,
          messages: data.messages,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : data.updatedAt
        } as ChatSession);
      });
      
      sessions.sort((a, b) => b.updatedAt - a.updatedAt);
      return sessions;
    } catch (error) {
      console.error("Error getting user sessions from Firestore:", error);
      return [];
    }
  },

  /**
   * Deletes a specific session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, SESSIONS_COLLECTION, sessionId));
    } catch (error) {
      console.error("Error deleting session from Firestore:", error);
      throw error;
    }
  },

  /**
   * Efficiently adds a message to a session
   */
  async addMessageToSession(sessionId: string, message: ChatMessage, sessionTitle?: string): Promise<void> {
    try {
      const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
      
      const updates: any = {
        messages: arrayUnion(message),
        updatedAt: Timestamp.now()
      };
      
      if (sessionTitle) {
        updates.title = sessionTitle;
      }
      
      await updateDoc(sessionRef, updates);
    } catch (error) {
      // If document doesn't exist, we might need a full saveSession call first
      console.error("Error adding message via arrayUnion:", error);
    }
  },

  /**
   * Subscribes to real-time updates for a user's sessions
   */
  subscribeToUserSessions(userId: string, callback: (sessions: ChatSession[]) => void) {
    const q = query(
      collection(db, SESSIONS_COLLECTION),
      where("userId", "==", userId)
    );

    return onSnapshot(q, (querySnapshot) => {
      const sessions: ChatSession[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        sessions.push({
          id: data.id,
          title: data.title,
          messages: data.messages,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : data.updatedAt
        } as ChatSession);
      });
      sessions.sort((a, b) => b.updatedAt - a.updatedAt);
      callback(sessions);
    }, (error) => {
      console.error("Real-time sync error:", error);
    });
  }
};
