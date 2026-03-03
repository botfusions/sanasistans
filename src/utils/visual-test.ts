import { ImageEmbeddingService } from "./image-embedding.service";
import { QdrantService } from "./qdrant.service";
import fs from "fs";
import path from "path";
import pino from "pino";

const logger = pino({ name: "VisualTest" });

async function runTest() {
  const imageEmbeddingService = new ImageEmbeddingService();
  const qdrantService = new QdrantService();

  // 1. Qdrant Connection Check
  logger.info("Checking Qdrant connection...");
  const isConnected = await qdrantService.checkConnection();
  if (!isConnected) {
    logger.error("Qdrant connection failed. Make sure Qdrant is running.");
    return;
  }

  // 2. Find a sample image
  // We'll look for any image in data/orders if exists, or use a dummy buffer if not
  const sampleImagePath = path.join(process.cwd(), "test-product.jpg");
  let imageBuffer: Buffer;

  if (fs.existsSync(sampleImagePath)) {
    imageBuffer = fs.readFileSync(sampleImagePath);
    logger.info(`Using sample image: ${sampleImagePath}`);
  } else {
    logger.warn("Sample image (test-product.jpg) not found. Creating a dummy buffer for simulation...");
    imageBuffer = Buffer.alloc(100, "dummy-image-data");
  }

  // 3. Generate Embedding
  logger.info("Generating embedding for the image...");
  const vector = await imageEmbeddingService.generateImageEmbedding(imageBuffer, "jpg");
  
  if (vector && vector.length === 1536) {
    logger.info("✅ Embedding generated successfully (1536 dimensions).");
  } else {
    logger.error("❌ Failed to generate proper embedding.");
    return;
  }

  // 4. Upsert to Qdrant
  const productId = "test-prod-123";
  const metadata = {
    productName: "Test Sandalye",
    customerName: "Test Müşteri",
    orderNo: "ORD-TEST-001",
    tags: ["test", "modern", "ahşap"]
  };

  logger.info("Upserting image to Qdrant visual memory...");
  await qdrantService.upsertImage(productId, vector, metadata);
  logger.info("✅ Test completed successfully.");
}

runTest().catch(err => {
  logger.error({ err }, "Test script error");
});
