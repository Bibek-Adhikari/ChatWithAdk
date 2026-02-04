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
  const key = import.meta.env.VITE_GEMINI_API_KEY || "";
  
  if (key) {
    const masked = key.substring(0, 6) + "..." + key.substring(key.length - 4);
    console.log(`AI Init - Key: ${masked}`);
  }

  if (!key || key.length < 10) {
    throw new Error("Invalid or missing API Key. Please check your .env.local file.");
  }
  
  // Use v1beta to support the newer/experimental models available to this key
  return new GoogleGenAI({ apiKey: key, apiVersion: 'v1beta' });
}

let aiInstance: GoogleGenAI | null = null;
const getAiInstance = () => {
  if (!aiInstance) aiInstance = getAI();
  return aiInstance;
};

export interface ChatHistoryEntry {
  role: 'user' | 'model';
  parts: (
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  )[];
}

// Updated fallback list based on actual models available to this specific key
const FALLBACK_MODELS = [
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-flash-lite-latest'
];

export async function generateTextResponse(
  prompt: string, 
  history: ChatHistoryEntry[],
  image?: { data: string; mimeType: string }
): Promise<string> {
  const ai = getAiInstance();
  let lastError: any = null;

  for (const modelName of FALLBACK_MODELS) {
    try {
      console.log(`Trying model: ${modelName}`);
      
      const parts: any[] = [{ text: prompt }];
      if (image) {
        parts.push({ inlineData: image });
      }

      const result = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...history.map(h => ({
            role: h.role,
            parts: h.parts.map(p => {
              if ('text' in p) return { text: p.text };
              if ('inlineData' in p) return { inlineData: p.inlineData };
              return { text: '' };
            })
          })),
          { role: 'user', parts }
        ],
        config: {
          temperature: 0.7,
          systemInstruction: "You are ChatADK, a helpful and intelligent AI assistant developed by Bibek Adhikari. When asked who you are or who developed you, always identify as ChatADK and mention your creator Bibek Adhikari. Be polite, professional, and concise in your responses.",
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

      // If it's a quota issue, we should wait slightly before trying the next model
      if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
        console.warn("Quota exceeded, waiting 2 seconds...");
        await new Promise(r => setTimeout(r, 2000));
        continue; // Try next model
      }

      // If it's a 404, we'll try the next model in the list
      if (errorMsg.includes("404") || errorMsg.includes("not found")) {
        continue;
      }

      // Small delay between different models to avoid bursting
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // If we're here, all models failed
  if (lastError?.message?.includes("429") || lastError?.message?.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("Rate limit reached. Please wait a few seconds before trying again.");
  }

  throw new Error(lastError?.message || "All fallback models failed. Please check your API key and connection.");
}
