import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

async function verifyOrder(orderId: string) {
  const { data: items, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (error) {
    fs.writeFileSync(
      "verify_results.txt",
      `❌ Error fetching items: ${JSON.stringify(error)}`,
    );
    return;
  }

  let output = `=== Order: ${orderId} ===\n`;
  output += `Found ${items.length} items.\n`;
  items.forEach((item, index) => {
    output += `${index + 1}. Product: ${item.product} | Dept: ${item.department} | Status: ${item.status}\n`;
  });

  fs.writeFileSync("verify_results.txt", output);
}

const args = process.argv.slice(2);
if (args.length > 0) {
  verifyOrder(args[0]);
} else {
  console.log("Usage: npx ts-node scripts/verify-order.ts <order_id>");
}
