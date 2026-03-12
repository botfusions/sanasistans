import { Bot } from "grammy";
import * as dotenv from "dotenv";

dotenv.config();

async function diagnoseBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN bulunamadı!");
    return;
  }

  const bot = new Bot(token);

  try {
    const me = await bot.api.getMe();
    console.log(`✅ Bot Kimliği: @${me.username} (${me.id})`);

    const webhookInfo = await bot.api.getWebhookInfo();
    console.log(`🌐 Webhook Durumu:`);
    console.log(`   - URL: ${webhookInfo.url || "Ayarlı Değil (Polling)"}`);
    console.log(
      `   - Bekleyen Güncellemeler: ${webhookInfo.pending_update_count}`,
    );
    if (webhookInfo.last_error_message) {
      console.log(`   - Son Hata: ${webhookInfo.last_error_message}`);
    }

    if (chatId) {
      console.log(`📡 Test mesajı gönderiliyor (Chat ID: ${chatId})...`);
      try {
        await bot.api.sendMessage(
          chatId,
          "🔔 *Sistem Teşhis Mesajı*\n\nBot şu an aktif ve mesaj gönderebiliyor.",
          {
            parse_mode: "Markdown",
          },
        );
        console.log("✅ Test mesajı başarıyla gönderildi!");
      } catch (sendErr: any) {
        console.error(`❌ Mesaj gönderilemedi: ${sendErr.message}`);
        if (sendErr.message.includes("chat not found")) {
          console.log(
            "💡 İpucu: Botun bu gruba/kanala ekli olduğundan ve gizlilik ayarlarının mesaj gönderimine izin verdiğinden emin olun.",
          );
        }
      }
    }
  } catch (err: any) {
    console.error("❌ Teşhis sırasında hata:", err.message);
  }
}

diagnoseBot();
