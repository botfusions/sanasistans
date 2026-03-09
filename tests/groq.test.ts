import fs from "fs";
import Groq from "groq-sdk";
import * as dotenv from "dotenv";

dotenv.config();

async function transcribeWithGroq(filePath: string) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-large-v3",
      response_format: "json",
      language: "tr",
    });

    console.log("Groq Sonuç:", transcription);
  } catch (e) {
    console.error("Hata:", e);
  }
}
