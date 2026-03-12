const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL or SUPABASE_KEY not found in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log("--- Database Cleanup Started ---");
  try {
    // Bekleyen görevleri sil
    const { error: taskError, count: taskCount } = await supabase
      .from("order_items")
      .delete({ count: "exact" })
      .in("status", ["new", "bekliyor", "atama_bekliyor"]);

    if (taskError) {
      console.error("Order items cleanup error:", taskError);
    } else {
      console.log(`Successfully deleted ${taskCount || 0} order items.`);
    }

    // Bekleyen siparişleri sil
    const { error: orderError, count: orderCount } = await supabase
      .from("orders")
      .delete({ count: "exact" })
      .in("status", ["new", "bekleyen"]);

    if (orderError) {
      console.error("Order cleanup error:", orderError);
    } else {
      console.log(`Successfully deleted ${orderCount || 0} orders.`);
    }

    console.log("--- Database Cleanup Finished ---");
  } catch (err) {
    console.error("Unexpected error during cleanup:", err);
  }
}

cleanup();
