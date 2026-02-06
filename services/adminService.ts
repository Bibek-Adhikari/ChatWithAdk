
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  Timestamp,
  serverTimestamp,
  getCountFromServer,
  getDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { User } from "firebase/auth";

export interface ModelConfig {
  fast: 'groq' | 'gemini' | 'research' | 'openrouter';
  research: 'groq' | 'gemini' | 'research' | 'openrouter';
  detail: 'groq' | 'gemini' | 'research' | 'openrouter';
  imagine: 'imagine';
  motion: 'motion';
}

const SYSTEM_COLLECTION = "system";
const CONFIG_DOC = "config";

const DEFAULT_CONFIG: ModelConfig = {
  fast: 'groq',
  research: 'research',
  detail: 'gemini',
  imagine: 'imagine',
  motion: 'motion'
};

const USERS_COLLECTION = "users";
const SESSIONS_COLLECTION = "sessions";

export const adminService = {
  /**
   * Syncs user profile to Firestore for admin tracking
   */
  async syncUser(user: User): Promise<void> {
    try {
      const userRef = doc(db, USERS_COLLECTION, user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: serverTimestamp(),
        createdAt: user.metadata.creationTime ? Timestamp.fromDate(new Date(user.metadata.creationTime)) : serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Error syncing user:", error);
    }
  },

  /**
   * Fetches latest registered users (Admin only)
   */
  async getLatestUsers(limitCount: number = 10): Promise<any[]> {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        orderBy("lastLogin", "desc"),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastLogin: doc.data().lastLogin?.toMillis() || Date.now()
      }));
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  },

  /**
   * Fetches system-wide stats (Admin only)
   */
  async getSystemStats(): Promise<{ totalUsers: number; totalSessions: number }> {
    try {
      const usersCount = await getCountFromServer(collection(db, USERS_COLLECTION));
      const sessionsCount = await getCountFromServer(collection(db, SESSIONS_COLLECTION));
      
      return {
        totalUsers: usersCount.data().count,
        totalSessions: sessionsCount.data().count
      };
    } catch (error) {
      console.error("Error fetching stats:", error);
      return { totalUsers: 0, totalSessions: 0 };
    }
  },

  /**
   * Fetches the system model configuration
   */
  async getModelConfig(): Promise<ModelConfig> {
    try {
      const configRef = doc(db, SYSTEM_COLLECTION, CONFIG_DOC);
      const configSnap = await getDoc(configRef);
      
      if (configSnap.exists()) {
        return { ...DEFAULT_CONFIG, ...configSnap.data() } as ModelConfig;
      }
      
      return DEFAULT_CONFIG;
    } catch (error) {
      console.error("Error fetching model config:", error);
      return DEFAULT_CONFIG;
    }
  },

  /**
   * Updates the system model configuration
   */
  async updateModelConfig(config: Partial<ModelConfig>): Promise<void> {
    try {
      const configRef = doc(db, SYSTEM_COLLECTION, CONFIG_DOC);
      await setDoc(configRef, config, { merge: true });
    } catch (error) {
      console.error("Error updating model config:", error);
      throw error;
    }
  }
};
