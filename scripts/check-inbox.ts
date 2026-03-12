import { GmailService } from "../src/utils/gmail.service";
import dotenv from "dotenv";

dotenv.config();

async function checkInbox() {
  console.log("🔍 Yeni e-postalar kontrol ediliyor...");
  const gmail = GmailService.getInstance();

  try {
    // Sadece kontrol etmekle kalmayıp, UID'yi de takip edelim
    await gmail.processUnreadMessages(1, async (msg) => {
      console.log(`📩 İşleniyor: ${msg.subject} (UID: ${msg.uid})`);
      console.log(`📎 Ek sayısı: ${msg.attachments?.length || 0}`);

      // Burada ana işlem mantığını (index.ts'deki gibi) simüle edebiliriz veya
      // sadece yakalayıp yakalamadığını görebiliriz.
      // EĞER burada log görünmüyorsa, UID zaten 'okundu' (Seen) işaretlendiği için processUnreadMessages bunu atlıyordur.
    });
    console.log("✅ İşlem tamamlandı.");
  } catch (error) {
    console.error("❌ E-posta işleme hatası:", error);
  }
}

checkInbox();
