import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

async function checkItems() {
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("❌ Supabase error:", error);
  } else {
    console.log("✅ Last 10 order items:");
    console.table(
      data.map((item) => ({
        id: item.id,
        product_name: item.product_name,
        customer_name: item.customer_name,
        created_at: item.created_at,
      })),
    );
  }
}

checkItems();
