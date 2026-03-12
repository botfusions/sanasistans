import * as dotenv from "dotenv";
import { GmailService } from "./gmail.service";
import { OrderService } from "./order.service";
import { XlsxUtils } from "./xlsx-utils";
import { pino } from "pino";

const logger = pino();
dotenv.config();

async function runTest(uid: number) {
  const gmailService = GmailService.getInstance();
  const orderService = new OrderService();

  logger.info(`🔍 Fetching email UID: ${uid}...`);
  const msg = await gmailService.fetchOneMessage(uid);

  if (!msg) {
    logger.error(`❌ Email UID ${uid} not found.`);
    return;
  }

  logger.info(`📩 Email fetched: ${msg.subject}`);

  if (!msg.attachments || msg.attachments.length === 0) {
    logger.warn(`⚠️ No attachments found in email UID ${uid}`);
    return;
  }

  for (const attr of msg.attachments) {
    if (attr.filename.endsWith(".xlsx") || attr.filename.endsWith(".xls")) {
      logger.info(`🔍 Parsing Excel: ${attr.filename}`);
      const excelRows = await XlsxUtils.parseExcel(attr.content);
      logger.info(`✅ Excel parsed. Row count: ${excelRows.length}`);

      const promptData = excelRows.map((r) => {
        const copy = { ...r };
        delete (copy as any)._imageBuffer;
        return copy;
      });

      logger.info(`🧠 Calling parseAndCreateOrder...`);
      const order = await orderService.parseAndCreateOrder(
        msg.subject,
        JSON.stringify(promptData, null, 2),
        msg.uid.toString(),
        msg.attachments,
      );

      if (order) {
        logger.info(`✅ Order processed: ${order.orderNumber}`);
      } else {
        logger.error(`❌ Order processing failed.`);
      }
    }
  }
}

const targetUid = Number(process.argv[2]) || 69;
runTest(targetUid).catch((err) => {
  logger.error({ err }, "Fatal error during test");
  process.exit(1);
});
