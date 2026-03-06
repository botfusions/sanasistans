import fs from "fs";
import path from "path";
import os from "os";
import { Context } from "grammy";
import FormData from "form-data";
import fetch from "node-fetch";
import * as dotenv from "dotenv";

dotenv.config();

export class VoiceService {
  constructor() {}

  public async transcribeVoiceMessage(ctx: Context, fileId: string, lang: string = "ru"): Promise<string | null> {
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey || groqKey.trim() === "") {
        console.error("❌ GROQ_API_KEY bulunamadı. Lütfen .env dosyasına ekleyin.");
        return null; // Groq key is mandatory for STT if OpenRouter gives no STT.
    }

    try {
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) throw new Error("Dosya yolu bulunamadı");

      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const response = await fetch(fileUrl);
      
      if (!response.ok) throw new Error(`Dosya indirilemedi: ${response.statusText}`);
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const tempFilePath = path.join(os.tmpdir(), `voice_${fileId}.ogg`);
      fs.writeFileSync(tempFilePath, buffer);

      // Groq üzerinden Whisper V3 ile çeviri
      const formData = new FormData();
      formData.append("file", fs.createReadStream(tempFilePath));
      formData.append("model", "whisper-large-v3");
      formData.append("language", lang);
      formData.append("response_format", "json");

      const groqResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
              "Authorization": `Bearer ${groqKey}`
          },
          body: formData,
      });

      const data = await groqResponse.json() as any;

      // İşlem bitince geçici dosyayı temizle
      if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
      }

      if (!groqResponse.ok) {
          console.error("Groq çeviri hatası:", data);
          return null;
      }

      return data.text || null;
    } catch (error) {
      console.error("Sesli mesaj çeviri hatası:", error);
      return null;
    }
  }
}

