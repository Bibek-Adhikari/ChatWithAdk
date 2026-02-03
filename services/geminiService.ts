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
  // Use Vite's standard env loading
  const key = import.meta.env.VITE_GEMINI_API_KEY || "";
  
  if (key) {
    const masked = key.substring(0, 6) + "..." + key.substring(key.length - 4);
    console.log(`AI Init - Key: ${masked}`);
  }

  if (!key || key.length < 10) {
    throw new Error("Invalid or missing API Key. Please check your .env.local file.");
  }
  
  // Use v1 for maximum stability with 1.5 models
  return new GoogleGenAI({ apiKey: key, apiVersion: 'v1' });
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

const FALLBACK_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro'
];

export async function generateTextResponse(prompt: string, history: ChatHistoryEntry[]): Promise<string> {
  const ai = getAiInstance();
  let lastError: any = null;

  for (const modelName of FALLBACK_MODELS) {
    try {
      console.log(`Trying model: ${modelName}`);
      
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
      const errorMsg = err.message || JSON.stringify(err);
      console.error(`Error with ${modelName}:`, errorMsg);

      // If key is definitely bad, stop immediately
      if (errorMsg.includes("expired") || errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("PERMISSION_DENIED")) {
        throw new Error("The API key provided is invalid or expired. Please get a fresh key from AI Studio.");
      }

      // If it's a 404, we'll try the next model in the list
      if (errorMsg.includes("404") || errorMsg.includes("not found")) {
        continue;
      }

      // For rate limits, wait a bit and try next
      if (errorMsg.includes("429")) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
    }
  }

  throw new Error(lastError?.message || "Failed to connect to Gemini. Check your API key and quota.");
}
