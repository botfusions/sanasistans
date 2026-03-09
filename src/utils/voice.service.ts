import fs from "fs";
import path from "path";
import os from "os";
import { Context } from "grammy";
import fetch from "node-fetch";
import Groq from "groq-sdk";
import * as dotenv from "dotenv";

dotenv.config();

export class VoiceService {
  private groq: Groq | null = null;

  constructor() {
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey.trim() !== "") {
      this.groq = new Groq({ apiKey: groqKey });
    }
  }

  public async transcribeVoiceMessage(
    ctx: Context,
    fileId: string,
    lang: string = "tr",
  ): Promise<string | null> {
    if (!this.groq) {
      console.error(
        "❌ GROQ_API_KEY bulunamadı. Lütfen .env dosyasına ekleyin.",
      );
      return null;
    }

    try {
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) throw new Error("Dosya yolu bulunamadı");

      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const response = await fetch(fileUrl);

      if (!response.ok)
        throw new Error(`Dosya indirilemedi: ${response.statusText}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const tempFilePath = path.join(os.tmpdir(), `voice_${fileId}.ogg`);
      fs.writeFileSync(tempFilePath, buffer);

      // Groq SDK kullanarak Whisper V3 ile çeviri
      const transcription = await this.groq.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-large-v3",
        language: lang,
        response_format: "json",
      });

      // İşlem bitince geçici dosyayı temizle
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      return transcription.text || null;
    } catch (error) {
      console.error("Sesli mesaj çeviri hatası:", error);
      return null;
    }
  }
}
