import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Debug log (obfuscated)
console.log("VITE_GEMINI_API_KEY check:", apiKey ? `Present (Starts with: ${apiKey.substring(0, 4)}...)` : "MISSING");

function getAI() {
  if (!apiKey || apiKey === 'your_api_key_here') {
    console.error("VITE_GEMINI_API_KEY is not set in .env.local");
  }
  return new GoogleGenAI({ apiKey: apiKey || "" });
}

let aiInstance: GoogleGenAI | null = null;
const getAiInstance = () => {
  if (!aiInstance) aiInstance = getAI();
  return aiInstance;
};

export interface ChatHistoryEntry {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export async function generateTextResponse(prompt: string, history: ChatHistoryEntry[]): Promise<string> {
  const ai = getAiInstance();
  
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: `You are ChatWithAdk, a highly intelligent and creative assistant. 
        Respond naturally with helpful, concise, and professional information.`,
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
      },
    });
    
    return result.text;
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    throw new Error(err.message || "Failed to generate response from Gemini.");
  }
}

