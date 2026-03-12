import { SupabaseService } from "../src/utils/supabase.service";
import * as dotenv from "dotenv";

dotenv.config();

async function verifyResults() {
  const supabase = SupabaseService.getInstance();

  console.log("🔍 Son 5 sipariş kontrol ediliyor...");
  const { data: orders, error: oError } = await (supabase as any).client
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (oError) {
    console.error("❌ Siparişler çekilemedi:", oError);
  } else {
    console.table(orders);

    if (orders.length > 0) {
      const lastOrderId = orders[0].id;
      console.log(`\n📋 Sipariş Kalemleri (ID: ${lastOrderId}):`);
      const { data: items, error: iError } = await (supabase as any).client
        .from("order_items")
        .select("id, product, department, quantity")
        .eq("order_id", lastOrderId);

      if (iError) console.error("❌ Kalemler çekilemedi:", iError);
      else console.table(items);
    }
  }
}

verifyResults();
