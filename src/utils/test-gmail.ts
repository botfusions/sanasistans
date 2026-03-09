import { ImapFlow } from "imapflow";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function testGmail() {
  console.log("🔍 Gmail IMAP Bağlantısı Test Ediliyor...");
  console.log(`📧 Kullanıcı: ${process.env.GMAIL_USER}`);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER || "",
      pass: process.env.GMAIL_PASS || "",
    },
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ BAĞLANTI BAŞARILI! Bot mailleri okuyabilir.");
    await client.logout();
  } catch (error: any) {
    console.error("❌ HATA OLUŞTU:");
    console.error(`Mesaj: ${error.message}`);
    if (error.response) {
      console.error(`Sunucu Yanıtı: ${error.response}`);
    }

    if (error.message.includes("Invalid credentials")) {
      console.log(
        "💡 Tavsiye: Şifre hatalı görünüyor. Lütfen 'Uygulama Şifresi' (App Password) kullandığınızdan emin olun.",
      );
    } else if (error.message.includes("ETIMEDOUT")) {
      console.log("💡 Tavsiye: Sunucuya erişilemiyor (Zaman aşımı).");
    }
  }
}

testGmail();
