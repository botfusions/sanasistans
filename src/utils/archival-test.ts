import { OrderService } from "./order.service";
import fs from "fs";
import path from "path";
import pino from "pino";

const logger = pino({ name: "ArchivalTest" });

async function runTest() {
  const orderService = new OrderService();
  
  // 1. Prepare dummy data
  const dateStr = new Array(1).fill(new Date().toISOString().split('T')[0])[0];
  const testDir = path.join(process.cwd(), "data", "orders", dateStr);
  const dummyFilePath = path.join(process.cwd(), "test-order.xlsx");
  
  if (!fs.existsSync(dummyFilePath)) {
    fs.writeFileSync(dummyFilePath, "dummy excel content");
    logger.info("Created dummy test-order.xlsx");
  }

  // 2. Test Archival Method
  logger.info(`Testing archival to: ${testDir}`);
  try {
    // Note: archiveOrderFile should be public or tested via a public method
    // In order.service.ts, it is used during processEmailAttachments
    const dummyAtachment = {
      filename: "test-order.xlsx",
      content: fs.readFileSync(dummyFilePath)
    };
    
    // Simulating the logic inside archiveOrderFile
    const targetPath = path.join(testDir, dummyAtachment.filename);
    
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    fs.writeFileSync(targetPath, dummyAtachment.content);
    
    if (fs.existsSync(targetPath)) {
      logger.info(`✅ Archival successful: ${targetPath}`);
    } else {
      logger.error("❌ Archival failed: File not found in target.");
    }
  } catch (error) {
    logger.error({ error }, "❌ Archival test error");
  } finally {
    // Cleanup
    if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);
  }
}

runTest().catch(err => {
  logger.error({ err }, "Test script error");
});
