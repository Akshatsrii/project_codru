import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();


const genai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});
export { genai };
