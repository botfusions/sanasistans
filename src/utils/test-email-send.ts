import { GmailService } from "./gmail.service";
import * as dotenv from "dotenv";
import * as path from "path";

// .env dosyasını yükle
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function testEmailSend() {
  console.log("🚀 E-posta Gönderme Testi Başlatılıyor...");
  console.log(`📧 Gönderen: ${process.env.GMAIL_USER}`);

  const gmailService = GmailService.getInstance();

  const testRecipient = process.env.GMAIL_USER; // Kendimize gönderelim
  const subject = "Asistan Test Mesajı";
  const body = `
    Merhaba,
    
    Bu bir yerel test e-postasıdır. 
    Eğer bu maili alıyorsanız, asistanın mail gönderme fonksiyonu başarıyla çalışıyor demektir.
    
    Tarih: ${new Date().toLocaleString("tr-TR")}
  `;

  if (!testRecipient) {
    console.error("❌ HATA: GMAIL_USER environment değişkeni bulunamadı!");
    return;
  }

  try {
    const success = await gmailService.sendEmail(testRecipient, subject, body);

    if (success) {
      console.log("✅ TEST BAŞARILI! E-posta kuyruğa alındı ve gönderildi.");
    } else {
      console.log("❌ TEST BAŞARISIZ! E-posta gönderilemedi.");
    }
  } catch (error: any) {
    console.error("💥 BEKLENMEDİK HATA:");
    console.error(error.message);
  }
}

testEmailSend();
