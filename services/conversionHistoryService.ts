import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc,
  Timestamp 
} from "firebase/firestore";
import { db } from "./firebase";
import { ConversionHistory } from "../types";

const CONVERSION_HISTORY_COLLECTION = "conversionHistory";

export const conversionHistoryService = {
  /**
   * Saves a conversion to Firestore
   */
  async saveConversion(userId: string, conversion: ConversionHistory): Promise<void> {
    try {
      const conversionRef = doc(db, CONVERSION_HISTORY_COLLECTION, conversion.id);
      
      await setDoc(conversionRef, {
        ...conversion,
        userId,
        timestamp: Timestamp.fromMillis(conversion.timestamp)
      }, { merge: true });
    } catch (error) {
      console.error("Error saving conversion to Firestore:", error);
      throw error;
    }
  },

  /**
   * Fetches all conversion history for a specific user
   */
  async getUserConversions(userId: string): Promise<ConversionHistory[]> {
    try {
      const q = query(
        collection(db, CONVERSION_HISTORY_COLLECTION),
        where("userId", "==", userId),
        orderBy("timestamp", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const conversions: ConversionHistory[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        conversions.push({
          id: data.id,
          userId: data.userId,
          sourceLang: data.sourceLang,
          targetLang: data.targetLang,
          sourceCode: data.sourceCode,
          targetCode: data.targetCode,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : data.timestamp
        } as ConversionHistory);
      });
      
      return conversions;
    } catch (error) {
      console.error("Error getting user conversions from Firestore:", error);
      return [];
    }
  },

  /**
   * Deletes a specific conversion
   */
  async deleteConversion(conversionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, CONVERSION_HISTORY_COLLECTION, conversionId));
    } catch (error) {
      console.error("Error deleting conversion from Firestore:", error);
      throw error;
    }
  },

  /**
   * Deletes all conversion history for a user
   */
  async clearUserHistory(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, CONVERSION_HISTORY_COLLECTION),
        where("userId", "==", userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error clearing user conversion history from Firestore:", error);
      throw error;
    }
  }
};
