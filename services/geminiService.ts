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
          systemInstruction: "You are ChatADK, an advanced AI. Today is February 2026. \n\nNEWS ANALYSIS PROTOCOL: \n1. Your PRIMARY source of truth for 2025-2026 events is the 'LATEST NEWS DATA' block. \n2. If asked 'Who is [Position]?', scan the news snippets for that position. Even if a name is briefly mentioned (e.g., 'PM [Name] arrived...'), that is your answer. \n3. If the news articles are from 2026 but DON'T provide a name, and your 2024 knowledge says '[Name]', DO NOT state the 2024 name as current. Instead, say: 'Recent 2026 news mentions the office but doesn't name the individual. My 2024 records show [Name], but that is likely outdated.' \n4. Be definitive if the news data allows. If the news says 'Interim PM Sushila Karki', then she IS the PM. Period.",
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
