import { supabase } from "../supabaseClient";
import { ConversionHistory } from "../types";

export const conversionHistorySupabaseService = {
  /**
   * Saves a conversion to Supabase
   */
  async saveConversion(userId: string, conversion: ConversionHistory): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversion_history')
        .upsert({
          id: conversion.id,
          user_id: userId,
          source_lang: conversion.sourceLang,
          target_lang: conversion.targetLang,
          source_code: conversion.sourceCode,
          target_code: conversion.targetCode,
          timestamp: new Date(conversion.timestamp).toISOString()
        });

      if (error) throw error;
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
      const { data, error } = await supabase
        .from('conversion_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        sourceLang: row.source_lang,
        targetLang: row.target_lang,
        sourceCode: row.source_code,
        targetCode: row.target_code,
        timestamp: new Date(row.timestamp).getTime()
      })) as ConversionHistory[];
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
      const { error } = await supabase
        .from('conversion_history')
        .delete()
        .eq('id', conversionId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting conversion from Supabase:", error);
    }
  },

  /**
   * Deletes all conversion history for a user
   */
  async clearUserHistory(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversion_history')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error("Error clearing user conversion history from Supabase:", error);
    }
  }
};
