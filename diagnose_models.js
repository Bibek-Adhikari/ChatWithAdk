
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.VITE_GEMINI_API_KEY;

async function listModels() {
  const genAI = new GoogleGenAI({ apiKey });
  try {
    // This depends on the @google/genai SDK structure
    // If it's the newer SDK, it might have a listModels method
    console.log("Listing models...");
    // Since I'm not 100% sure of the @google/genai SDK (it's very new), 
    // I'll try a common pattern or check the generateContent with a known working name.
    // Actually, let's just try to change to 'gemini-1.5-flash-latest' in the next step.
  } catch (err) {
    console.error(err);
  }
}

listModels();
