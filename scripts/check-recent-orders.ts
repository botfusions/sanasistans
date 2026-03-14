import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

async function checkRecent() {
  const { data: dbOrders, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: dbItems, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (orderError || itemsError) {
    console.error("❌ Supabase error:", orderError, itemsError);
    return;
  }

  console.log("=== Recent Orders ===");
  console.log(JSON.stringify(dbOrders, null, 2));

  console.log("=== Recent Items ===");
  console.log(JSON.stringify(dbItems, null, 2));
}

checkRecent();
