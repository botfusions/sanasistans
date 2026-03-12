import { Bot } from "grammy";
import * as dotenv from "dotenv";

dotenv.config();

async function checkTelegramUpdates() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("❌ TOKEN eksik!");
    return;
  }

  const bot = new Bot(token);

  try {
    console.log("🔍 Son Telegram güncellemeleri kontrol ediliyor...");

    // Webhook varsa silelim ki polling ile görebilelim
    const webhookInfo = await bot.api.getWebhookInfo();
    if (webhookInfo.url) {
      console.log(
        `⚠️ Webhook aktif (${webhookInfo.url}). Polling testi için geçici olarak siliniyor...`,
      );
      await bot.api.deleteWebhook();
    }

    const updates = await bot.api.getUpdates({
      limit: 5,
      allowed_updates: ["message", "callback_query"],
    });

    if (updates.length === 0) {
      console.log("ℹ️ Bekleyen yeni mesaj bulunamadı.");
    } else {
      console.log(`✅ ${updates.length} adet güncelleme bulundu:`);
      updates.forEach((u) => {
        if (u.message) {
          console.log(
            `- Mesaj: "${u.message.text}" | Kimden: ${u.message.from?.first_name} (@${u.message.from?.username}) | Chat: ${u.message.chat.id}`,
          );
        } else if (u.callback_query) {
          console.log(
            `- Buton Tıklaması: "${u.callback_query.data}" | Chat: ${u.callback_query.message?.chat.id}`,
          );
        }
      });
    }

    // Webhook'u geri yükleyelim
    if (webhookInfo.url && process.env.BOT_MODE === "webhook") {
      console.log("🔄 Webhook geri yükleniyor...");
      await bot.api.setWebhook(webhookInfo.url, {
        secret_token: process.env.WEBHOOK_SECRET,
        drop_pending_updates: false,
      });
    }
  } catch (err: any) {
    console.error("❌ Güncellemeler alınamadı:", err.message);
  }
}

checkTelegramUpdates();
