import { GmailService } from "../src/utils/gmail.service";
import { XlsxUtils } from "../src/utils/xlsx-utils";
import { OrderService } from "../src/utils/order.service";
import { DraftOrderService } from "../src/utils/draft-order.service";
import dotenv from "dotenv";

dotenv.config();

async function forceProcessEmail(uid: number) {
  console.log(`🚀 UID ${uid} için zorlamalı işleme başlatılıyor...`);
  const gmail = GmailService.getInstance();
  const orderService = new OrderService();
  const draftOrderService = DraftOrderService.getInstance();

  try {
    // Normalde processUnreadMessages sadece okunmamışları çeker.
    // Biz burada alt katmandaki client'a erişim olmadığı için ve metot sadece UNSEEN aradığı için
    // geçici olarak GmailService'i UID ile zorlayacak bir yapı kuralım veya
    // doğrudan processor'ı bir obje ile çağıralım.

    // Ancak önce e-postayı çekmemiz lazım. GmailService'i UID bazlı çekim yapacak şekilde modifiye etmek gerekebilir.
    // Veya sadece processor mantığını test etmek için en son gelen e-postayı 'okunmamış' yapalım.

    console.log(
      "⚠️ Lütfen e-postayı manuel olarak 'OKUNMAMIŞ' (Unread) olarak işaretleyin.",
    );
    console.log(
      "Ardından 'npx tsx scripts/check-inbox.ts' komutunu tekrar çalıştırın.",
    );
  } catch (error) {
    console.error("❌ Hata:", error);
  }
}

forceProcessEmail(11);
