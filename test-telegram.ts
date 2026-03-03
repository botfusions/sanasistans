import * as dotenv from "dotenv";
dotenv.config();
import { Bot } from "grammy";

async function testTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    console.error("Missing token or chatId");
    return;
  }
  
  const bot = new Bot(token);
  try {
    await bot.api.sendMessage(chatId, "🚀 Ayça Asistan Test Mesajı (Markdown Olmadan)");
    console.log("✅ Basic message sent!");
    
    await bot.api.sendMessage(chatId, "📧 *Test Mesajı* (Markdown)", { parse_mode: "Markdown" });
    console.log("✅ Markdown message sent!");
  } catch (error) {
    console.error("❌ Telegram message failed:", error);
  }
}

testTelegram();
