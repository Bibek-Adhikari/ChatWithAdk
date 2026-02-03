import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (process.env as any).VITE_GEMINI_API_KEY;

// Debug log (obfuscated)
console.log("VITE_GEMINI_API_KEY check:", apiKey ? `Present (Starts with: ${apiKey.substring(0, 4)}...)` : "MISSING");

function getAI() {
  if (!apiKey || apiKey === 'your_api_key_here') {
    console.error("VITE_GEMINI_API_KEY is not set in .env.local");
  }
  return new GoogleGenAI(apiKey || "");
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
    const maxRetries = 1;

    while (retries <= maxRetries) {
      try {
        console.log(`Attempting with model: ${modelName} (Retry: ${retries})`);
        
        const model = ai.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 64,
          },
          systemInstruction: "You are ChatWithAdk, a highly intelligent and creative assistant. Respond naturally with helpful, concise, and professional information.",
        });

        // Use startChat for better history management
        const chat = model.startChat({
          history: history,
        });

        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        const text = response.text();
        
        if (!text) throw new Error("Empty response from AI");
        return text;
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message || "";
        const isQuotaError = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED");
        
        if (isQuotaError && retries < maxRetries) {
          const delay = Math.pow(2, retries) * 1000;
          console.warn(`Quota exceeded for ${modelName}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
          continue;
        }
        
        console.error(`Failed with model ${modelName}:`, errMsg);
        break; 
      }
    }
  }

  throw new Error(lastError?.message || "All models failed to generate response. Please check your API key and connection.");
}
