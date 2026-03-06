import { Bot } from "grammy";
import { CronService } from "./src/utils/cron.service";
import * as dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
  console.error("Token or Chat ID missing in .env");
  process.exit(1);
}

const bot = new Bot(token);

// CronService requires bot and chatId for initialization
const cronService = CronService.getInstance(bot, chatId);

async function runTest() {
  console.log("Starting checkProductionStatus test...");
  await cronService.checkProductionStatus();
  console.log("checkProductionStatus test completed.");
}

runTest().then(() => {
  console.log("Test script finished successfully.");
  process.exit(0);
}).catch(err => {
  console.error("Test script failed:", err);
  process.exit(1);
});
