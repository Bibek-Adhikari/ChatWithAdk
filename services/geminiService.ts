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

const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

export async function generateTextResponse(prompt: string, history: ChatHistoryEntry[]): Promise<string> {
  const ai = getAiInstance();
  let lastError: any = null;

  for (const modelName of FALLBACK_MODELS) {
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        console.log(`Attempting with model: ${modelName} (Retry: ${retries})`);
        const result = await ai.models.generateContent({
          model: modelName,
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
        lastError = err;
        const isQuotaError = err.message?.includes("429") || err.message?.includes("quota") || err.status === "RESOURCE_EXHAUSTED";
        
        if (isQuotaError && retries < maxRetries) {
          const delay = Math.pow(2, retries) * 1000;
          console.warn(`Quota exceeded for ${modelName}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
          continue;
        }
        
        console.error(`Failed with model ${modelName}:`, err.message);
        break; // Move to next model if it's not a retryable error or we ran out of retries
      }
    }
  }

  throw new Error(lastError?.message || "All models failed to generate response. Please try again later.");
}

