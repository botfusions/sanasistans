import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

async function check() {
  console.log("Fetching visual memory...");
  const { data, error } = await supabase
    .from("visual_memory")
    .select("id, product_name_tr, image_url, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Memory:", data);

  console.log("Fetching recent orders...");
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, pdf_url, created_at")
    .order("created_at", { ascending: false })
    .limit(2);

  if (orderError) console.error("Error:", orderError);
  console.log("Orders:", orderData);
}

check();
