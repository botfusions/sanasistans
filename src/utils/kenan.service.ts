import OpenAI from "openai";
import dotenv from "dotenv";
import { Staff } from "./staff.service";

dotenv.config();

export class KenanService {
  private client: OpenAI;
  private systemPrompt: string;

  constructor() {
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "https://sandaluci.com",
        "X-Title": "Sandaluci Kenan Life Coach",
      },
    });

    this.systemPrompt = `
Sen 20 yıllık deneyimli, son derece profesyonel, bilge ve empatik bir yaşam koçu olan Kenan'sın.
Sandaluci mobilya üretim atölyesi personeline, Ayça'nın (yapay zeka asistanı) yönlendirmesiyle motivasyon, tavsiye ve destek mesajları veriyorsun.
Amacın: İnsanların mesleki zorlukları aşmasına, potansiyellerini fark etmelerine ve güne enerjik, umutlu ve odaklanmış başlamalarına yadımcı olmak.

Konuşma Tarzın:
- Kibar, güven veren, babacan ama profesyonel.
- Çok uzun destanlar yazmadan, öz ve etkileyici (1-2 paragraf) cümleler kullan.
- Asla yapay bir bot gibi konuşma; gerçek bir usta/koç gibi hitap et.

Şimdi sana bir personelin bilgisi, günün vakti ve varsa günün/bölümün genel özellikleri verilecek.
Ona ismine hitap ederek, yaptığı işin (departmanının) zorluklarını anladığını hissettirerek motive edici bir yaşam koçu mesajı yaz.
Yazına şu tarz bir girişle diyebilirsin: "Merhaba [İsim], ben Kenan. Bugün..."
Mümkünse mesajın sonuna küçük bir motive edici veya düşündürücü eylem/soru bırak.
    `.trim();
  }

  public async generateCoachingMessage(staff: Staff, context: string = "Sabah motivasyonu"): Promise<string> {
    try {
      const userMessage = `
Lütfen aşağıdaki personel için özel bir mesaj hazırla:
İsim: ${staff.name}
Departman: ${staff.department}
Günün / Durumun Özelliği: ${context}
      `.trim();

      const messages: any[] = [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: userMessage }
      ];

      const completion = await this.client.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || "qwen/qwen3.5-35b-a3b",
        messages: messages,
      });

      return completion.choices[0].message.content || "Sevgili kardeşim, bugün de elinden gelenin en iyisini yapacağına inancım tam. Başarılar dilerim. - Kenan";
    } catch (error) {
      console.error("❌ KenanService (OpenRouter) hatası:", error);
      return "Günaydın! Bugün harika işler çıkaracağına eminim. Rast gelsin. - Kenan";
    }
  }
}
