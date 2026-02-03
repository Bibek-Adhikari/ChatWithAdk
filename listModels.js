import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const apiKey = process.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function listModels() {
  try {
    const models = await ai.models.list();
    console.log(JSON.stringify(models, null, 2));
  } catch (err) {
    console.error(err);
  }
}

listModels();
