import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

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

export async function generateTextResponse(prompt: string, history: {role: string, parts: {text: string}[]}[]): Promise<string> {
  const ai = getAiInstance();
  
  const response: GenerateContentResponse = await (ai as any).models.generateContent({
    model: 'gemini-1.5-flash', // Using a highly stable model name
    contents: [
      ...history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: h.parts.map(p => ({ text: p.text || (p as any).content }))
      })),
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
  
  return response.text || "I'm sorry, I couldn't process that request.";
}

