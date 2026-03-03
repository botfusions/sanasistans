import * as dotenv from "dotenv";
import { Bot } from "grammy";

dotenv.config();

const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

console.log("🤖 Telegram Bağlantı Testi Başlatılıyor...");
console.log(`🔑 Token: ${token ? token.substring(0, 5) + "..." : "YOK"}`);
console.log(`👤 Chat ID: ${chatId}`);

if (!token || !chatId) {
    console.error("❌ HATA: Token veya Chat ID eksik!");
    process.exit(1);
}

const bot = new Bot(token);

async function testConnection() {
    try {
        console.log("🛰️ Bot bilgileri alınıyor...");
        const me = await bot.api.getMe();
        console.log(`✅ Bot Aktif: @${me.username}`);
        
        console.log(`📤 ${chatId} adresine test mesajı gönderiliyor...`);
        const result = await bot.api.sendMessage(parseInt(chatId), "🚀 *ASİSTAN BAĞLANTI TESTİ*\n\nBu mesajı alıyorsanız botunuz düzgün çalışıyor demektir.", { parse_mode: "Markdown" });
        console.log("✅ Mesaj başarıyla gönderildi! Message ID:", result.message_id);
    } catch (error: any) {
        console.error("❌ TELEGRAM HATASI:", error.message || error);
        if (error.parameters) {
            console.error("Hata Detayı:", JSON.stringify(error.parameters));
        }
    }
}

testConnection().catch(console.error);
