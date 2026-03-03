import { QdrantClient } from "@qdrant/js-client-rest";
import * as dotenv from "dotenv";
import pino from "pino";

dotenv.config();
const logger = pino({ name: "QdrantCheck" });

async function checkQdrant() {
  const url = process.env.QDRANT_URL || "https://qdrant.turklawai.com";
  const apiKey = process.env.QDRANT_API_KEY;

  if (!apiKey) {
    logger.error("❌ QDRANT_API_KEY .env dosyasında bulunamadı!");
    return;
  }

  logger.info(`🔍 Qdrant bağlantısı deneniyor: ${url}`);

  if (!url) {
    logger.error("❌ QDRANT_URL .env dosyasında bulunamadı!");
    return;
  }

  const client = new QdrantClient({
    url,
    apiKey,
    checkCompatibility: false
  });

  try {
    const startTime = Date.now();
    const collections = await client.getCollections();
    const duration = Date.now() - startTime;
    
    logger.info(`✅ Qdrant BAĞLI! (${duration}ms)`);
    logger.info(`📦 Mevcut Koleksiyonlar: ${collections.collections.map(c => c.name).join(", ")}`);
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      stack: error.stack,
      cause: error.cause 
    }, "❌ Qdrant bağlantı hatası detayları");
    
    if (error.message.includes("fetch failed")) {
      logger.info("💡 İpucu: Sunucuya ulaşılamıyor. DNS veya Firewall engeli olabilir.");
    }
  }
}

checkQdrant();
