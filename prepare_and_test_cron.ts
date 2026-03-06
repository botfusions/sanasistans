import { createClient } from "@supabase/supabase-js";
import { Bot } from "grammy";
import { CronService } from "./src/utils/cron.service";
import { OrderService } from "./src/utils/order.service";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

const TID = 6030287709;
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
const chatId = process.env.TELEGRAM_CHAT_ID!;

async function setupTestOrder() {
  console.log("Setting up test data in Supabase...");

  // 1. Insert an Order
  const orderId = "TEST-ORDER-123";
  const { error: orderErr } = await supabase.from("orders").upsert({
    id: orderId,
    order_number: "TEST-001",
    customer_name: "Test Customer (Marina)",
    delivery_date: new Date().toISOString(),
    status: "processing"
  }, { onConflict: "id" });

  if (orderErr) {
    console.error("Order Insert Error:", orderErr);
    return;
  }

  // 2. Insert an Order Item
  // Set distributed_at to 21 days ago
  const distDate = new Date();
  distDate.setDate(distDate.getDate() - 21);

  const { error: itemErr } = await supabase.from("order_items").upsert({
    id: "TEST-ITEM-123_0",
    order_id: orderId,
    product: "Test Koltuk",
    department: "Dikişhane",
    quantity: 1,
    details: "Test için üretildi",
    source: "Production",
    status: "uretimde",
    assigned_worker: "Marina Hanım (Test)",
    distributed_at: distDate.toISOString(),
    row_index: 0
  }, { onConflict: "id" });

  if (itemErr) {
    console.error("Order Item Insert Error:", itemErr);
    return;
  }

  console.log("Test data setup complete. Order item with 21 days delay created.");
}

async function runTest() {
  await setupTestOrder();

  console.log("Waiting 2 seconds for services to initialize...");
  // Sleep 2 seconds
  await new Promise(r => setTimeout(r, 2000));

  console.log("Initializing CronService and checking production status...");
  // OrderService constructor is called within CronService or app initialization
  // CronService uses OrderService internally which loads data asynchronously
  const cronService = CronService.getInstance(bot, chatId);
  
  // Wait another 3 seconds for initial load to finish inside CronService's orderService
  await new Promise(r => setTimeout(r, 3000));

  await cronService.checkProductionStatus();
  console.log("Test completed.");
  process.exit(0);
}

runTest();
