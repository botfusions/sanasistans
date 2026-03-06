const { Bot } = require("grammy");
const { CronService } = require("./dist/utils/cron.service") || {}; // Dist'ten deneme
const { config } = require("dotenv");

config();

async function run() {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
  
  // Sadece ilgili fonksiyonu manuel çağırmak için bir script
  // TS dosyalarını derlemeden çalıştırmak zor olacağından API üzerinden ya da doğrudan tetiklemeyi deneyeceğiz
  // Bu script'i TS-Node ile çalıştıralım:
}

run();
