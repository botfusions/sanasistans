import { OpenRouterService } from "./llm.service";
import pino from "pino";

const logger = pino({ name: "ImageEmbeddingService" });

export class ImageEmbeddingService {
  private llmService: OpenRouterService;

  constructor() {
    this.llmService = new OpenRouterService();
  }

  /**
   * Generates a vector embedding for an image.
   * Note: Since Gemini/OpenRouter doesn't directly return embeddings for images via chat,
   * we will use it to describe the image in detail and then embed the description,
   * or use a specialized model if available.
   * For now, we'll implement a 'Visual Description' to Vector approach.
   */
  async generateImageEmbedding(
    imageBuffer: Buffer,
    extension: string = "jpg",
  ): Promise<number[]> {
    try {
      const base64Image = imageBuffer.toString("base64");
      const mimeType = `image/${extension === "png" ? "png" : "jpeg"}`;

      const prompt = `
        Bu ürünü detaylıca analiz et ve teknik özelliklerini açıkla.
        Ürün tipi, malzemesi, rengi, tasarım stili (modern, klasik, rustik vb.) ve belirgin özelliklerini belirt.
        Sadece teknik açıklama yap, yorum ekleme.
      `;

      // Visual analysis via LLM
      const description = await this.llmService.chat(
        prompt,
        "Görsel Analiz ve Ürün Tanımlama Modu.",
        [], // No existing messages
        [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      );

      if (!description) {
        throw new Error("Görsel analiz başarısız oldu.");
      }

      logger.info(
        { description: description.substring(0, 100) + "..." },
        "Görsel analiz tamamlandı.",
      );

      // Embed the description
      // Note: In a real scenario, we'd use a dedicated embedding model.
      // Here we simulate a 1536-dim vector for compatibility with standard Qdrant setups
      // or use a simple hashing/projection if no embedding API is ready.
      return this.simulateEmbedding(description);
    } catch (error) {
      logger.error({ error }, "Görsel vektörleştirme hatası.");
      return new Array(1024).fill(0); // Fallback to 1024
    }
  }

  private simulateEmbedding(text: string): number[] {
    // This is a placeholder for actual text embedding API call
    // In production, use openai.embeddings.create or similar
    const vector = new Array(1024).fill(0);
    for (let i = 0; i < text.length; i++) {
      vector[i % 1024] += text.charCodeAt(i) / 1000;
    }
    return vector.map((v) => Math.tanh(v)); // Normalize
  }
}
