import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export class OpenRouterService {
  private client: OpenAI;
  private systemPrompt: string = "";

  constructor() {
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "https://sandaluci.com", // Opsiyonel
        "X-Title": "Sandaluci Ayça Asistan",
      },
    });
    this.loadSystemPrompt();
  }

  private loadSystemPrompt() {
    const promptPath = path.resolve(
      process.env.SYSTEM_PROMPT_PATH || "./docs/sandaluci_soul.md",
    );
    try {
      this.systemPrompt = fs.readFileSync(promptPath, "utf-8");
    } catch (error) {
      console.error("❌ Sistem promptu yüklenemedi:", error);
      this.systemPrompt = "Sen Sandaluci mobilya asistanı Ayça'sın.";
    }
  }

  public async chat(
    userMessage: string,
    context: string = "",
    history: any[] = [],
    images: any[] = []
  ) {
    try {
      const messages: any[] = [
        { role: "system", content: this.systemPrompt },
        ...history,
        {
          role: "user",
          content: [
            { type: "text", text: `Bağlam Bilgisi: ${context}\n\nKullanıcı Mesajı: ${userMessage}` },
            ...images
          ],
        },
      ];

      const completion = await this.client.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || "qwen/qwen3.5-35b-a3b",
        messages: messages,
      }, {
        timeout: 60000 // 60 saniye zaman aşımı
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error("❌ OpenRouter hatası detayı (Timeout veya API Hatası):", error);
      return null;
    }
  }
}
