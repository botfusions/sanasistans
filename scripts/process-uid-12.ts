import { GmailService } from "../src/utils/gmail.service";
import { OrderService } from "../src/utils/order.service";
import { XlsxUtils } from "../src/utils/xlsx-utils";
import * as dotenv from "dotenv";
import { pino } from "pino";

const logger = pino();
dotenv.config();

async function processUid12() {
  const uid = 12;
  console.log(`🚀 UID ${uid} için tam işleme başlatılıyor...`);

  const gmail = GmailService.getInstance();
  const orderService = new OrderService();

  try {
    const msg = await gmail.fetchOneMessage(uid);
    if (!msg) {
      console.error(`❌ Mesaj bulunamadı: UID ${uid}`);
      return;
    }

    console.log(`📩 Mesaj çekildi: ${msg.subject}`);
    console.log(`📎 Ek sayısı: ${msg.attachments?.length || 0}`);

    let excelProcessed = false;

    // 1. Ekleri kontrol et (Excel)
    if (msg.attachments && msg.attachments.length > 0) {
      for (const attr of msg.attachments) {
        if (
          attr.filename.endsWith(".xlsx") ||
          attr.filename.endsWith(".xls") ||
          attr.contentType ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ) {
          console.log(`📊 Excel ekleniyor: ${attr.filename}`);

          const excelData = await XlsxUtils.parseExcel(attr.content);
          if (excelData && excelData.length > 0) {
            console.log(`🧠 LLM ile Excel ayrıştırılıyor...`);
            const order = await orderService.parseAndCreateOrder(
              JSON.stringify(excelData),
              msg.subject,
              true,
              excelData,
            );

            if (order) {
              console.log(`✅ Sipariş başarıyla oluşturuldu! ID: ${order.id}`);
              excelProcessed = true;
            } else {
              console.error("❌ LLM sipariş oluşturamadı.");
            }
          }
        }
      }
    }

    // 2. Metin içeriği (Excel yoksa)
    if (!excelProcessed && msg.content && msg.content.trim().length > 10) {
      console.log("📝 Metin içeriği ayrıştırılıyor...");
      const order = await orderService.parseAndCreateOrder(
        msg.content,
        msg.subject,
      );
      if (order) {
        console.log(
          `✅ Sipariş başarıyla oluşturuldu (Metin)! ID: ${order.id}`,
        );
      }
    }

    console.log("🏁 Test işlemi tamamlandı.");
  } catch (err) {
    console.error("❌ Hata:", err);
  }
}

processUid12();
