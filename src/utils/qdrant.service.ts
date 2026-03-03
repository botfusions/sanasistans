import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
import pino from "pino";

dotenv.config();
const logger = pino({ name: "QdrantService" });

export class QdrantService {
  private client: QdrantClient;
  private collectionName: string;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY,
    });
    this.collectionName = process.env.QDRANT_COLLECTION || "sandaluci_memory";
  }

  public async checkConnection(): Promise<boolean> {
    try {
      await this.client.getCollections();
      logger.info("Qdrant connection successful");
      return true;
    } catch (error) {
      logger.error({ error }, "Qdrant connection failed");
      return false;
    }
  }

  public async search(queryVector: number[], limit: number = 3) {
    try {
      return await this.client.search(this.collectionName, {
        vector: queryVector,
        limit,
        with_payload: true,
      });
    } catch (error) {
      logger.error({ error }, "Qdrant search error");
      return [];
    }
  }

  public async upsert(id: string | number, vector: number[], payload: any) {
    try {
      await this.client.upsert(this.collectionName, {
        points: [{ id, vector, payload }],
      });
    } catch (error) {
      logger.error({ error }, "Qdrant upsert error");
    }
  }

  /**
   * Saves product images into the specialized collection.
   */
  public async upsertImage(
    productId: string,
    vector: number[],
    metadata: {
      productName: string;
      customerName: string;
      orderNo: string;
      tags: string[];
    }
  ) {
    try {
      const collection = process.env.QDRANT_IMAGE_COLLECTION || "sandaluci_visual_memory";
      
      // Ensure collection exists
      try {
        await this.client.getCollection(collection);
      } catch (e) {
        await this.client.createCollection(collection, {
          vectors: { size: 1536, distance: "Cosine" }
        });
      }

      await this.client.upsert(collection, {
        points: [{
          id: productId,
          vector,
          payload: {
            ...metadata,
            updatedAt: new Date().toISOString()
          }
        }]
      });
      logger.info({ productId }, "✅ Görsel hafızaya kaydedildi.");
    } catch (error) {
      logger.error({ error }, "Qdrant upsertImage error");
    }
  }
}
