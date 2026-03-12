import { SupabaseService } from "./supabase.service";
import * as dotenv from "dotenv";

dotenv.config();

async function verifyDb() {
  const supabase = SupabaseService.getInstance();

  console.log("🔍 Checking orders table...");
  const { data: orders, error: orderError } = await (supabase as any).client
    .from("orders")
    .select("*")
    .eq("order_number", "03032026-MARZHAN");

  if (orderError) {
    console.error("❌ Error fetching order:", orderError);
  } else {
    console.log(`✅ Order found: ${JSON.stringify(orders, null, 2)}`);

    if (orders && orders.length > 0) {
      const orderId = orders[0].id;
      console.log(`🔍 Checking order_items for order_id: ${orderId}...`);
      const { data: items, error: itemError } = await (supabase as any).client
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      if (itemError) {
        console.error("❌ Error fetching items:", itemError);
      } else {
        console.log(`✅ Found ${items.length} items.`);
        items.forEach((item: any) => {
          console.log(
            `   - Item: ${item.product}, Qty: ${item.quantity}, Dept: ${item.department}`,
          );
        });
      }
    }
  }
}

verifyDb().catch(console.error);
