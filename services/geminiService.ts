import { GoogleGenAI } from "@google/genai";

// Enhanced environment retrieval
const getEnv = (key: string): string => {
  // Try Vite's built-in way
  if (import.meta.env[key]) return import.meta.env[key];
  
  // Try process.env if available (bundlers sometimes inject this)
  try {
    const procEnv = (window as any).process?.env;
    if (procEnv && procEnv[key]) return procEnv[key];
  } catch (e) {}

  return "";
};

function getAI() {
  const key = getEnv('VITE_GEMINI_API_KEY') || getEnv('GEMINI_API_KEY');
  
  console.log("AI Init - Key length:", key ? key.length : 0);

  if (!key || key === 'undefined' || key === 'null') {
    throw new Error("An API Key must be set. Please check your .env.local file and ensure VITE_GEMINI_API_KEY is defined.");
  }
  
  // The @google/genai SDK expects an options object with apiKey
  return new GoogleGenAI({ apiKey: key });
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

const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

export async function generateTextResponse(prompt: string, history: ChatHistoryEntry[]): Promise<string> {
  const ai = getAiInstance();
  let lastError: any = null;

  for (const modelName of FALLBACK_MODELS) {
    try {
      console.log(`Using model: ${modelName}`);
      
      // In @google/genai SDK, we use ai.models.generateContent
      const result = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...history.map(h => ({
            role: h.role,
            parts: h.parts.map(p => ({ text: p.text }))
          })),
          { role: 'user', parts: [{ text: prompt }] }
        ],
        config: {
          temperature: 0.7,
        }
      });

      const text = result.text;
      
      if (text) return text;
    } catch (err: any) {
      lastError = err;
      console.error(`Error with ${modelName}:`, err.message || err);
      if (err.message?.includes("429")) {
        // Simple backoff
        await new Promise(r => setTimeout(r, 2000));
      }
      continue;
    }
  }

  throw new Error(lastError?.message || "All models failed. Check your connection or quota.");
}
