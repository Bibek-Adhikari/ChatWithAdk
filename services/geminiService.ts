
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateTextResponse(prompt: string, history: {role: string, parts: {text: string}[]}[]): Promise<string> {
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      ...history,
      { role: 'user', parts: [{ text: prompt }] }
    ],
    config: {
      systemInstruction: `You are ChatWithAdk, a highly intelligent and creative assistant. 
      If the user explicitly asks for an image, photo, or picture by describing it, or if it makes sense to visualize the topic, 
      YOU MUST START your response with exactly "/image " followed by a detailed visual description. 
      Example: "/image a futuristic neon city in the rain".
      Otherwise, respond naturally with helpful, concise, and professional information.`,
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
    },
  });
  
  return response.text || "I'm sorry, I couldn't process that request.";
}

export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  }
}
