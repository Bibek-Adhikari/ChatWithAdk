import { ConversionHistory } from "../types";
import { auth } from "./firebase";

export const conversionHistorySupabaseService = {
  /**
   * Saves a conversion to Supabase
   */
  async saveConversion(userId: string, conversion: ConversionHistory): Promise<void> {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/supabase/conversion-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: conversion.id,
          sourceLang: conversion.sourceLang,
          targetLang: conversion.targetLang,
          sourceCode: conversion.sourceCode,
          targetCode: conversion.targetCode,
          timestamp: conversion.timestamp
        })
      });

      if (!response.ok) {
        const raw = await response.text();
        throw new Error(raw || 'Supabase gateway error');
      }
    } catch (error) {
      console.error("Error saving conversion to Supabase:", error);
      // Don't throw - Supabase is backup only
    }
  },

  /**
   * Fetches all conversion history for a specific user
   */
  async getUserConversions(userId: string): Promise<ConversionHistory[]> {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return [];

      const response = await fetch('/api/supabase/conversion-history?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const raw = await response.text();
        throw new Error(raw || 'Supabase gateway error');
      }

      const payload = await response.json();
      return (payload?.data || []) as ConversionHistory[];
    } catch (error) {
      console.error("Error getting user conversions from Supabase:", error);
      return [];
    }
  },

  /**
   * Deletes a specific conversion
   */
  async deleteConversion(conversionId: string): Promise<void> {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch(`/api/supabase/conversion-history/${conversionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const raw = await response.text();
        throw new Error(raw || 'Supabase gateway error');
      }
    } catch (error) {
      console.error("Error deleting conversion from Supabase:", error);
    }
  },

  /**
   * Deletes all conversion history for a user
   */
  async clearUserHistory(userId: string): Promise<void> {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/supabase/conversion-history', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const raw = await response.text();
        throw new Error(raw || 'Supabase gateway error');
      }
    } catch (error) {
      console.error("Error clearing user conversion history from Supabase:", error);
    }
  }
};
