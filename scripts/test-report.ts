import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { OrderService } from "../src/utils/order.service";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

async function testReport() {
  const orderService = new OrderService();

  // Get the latest order
  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("order_number", "SD-000011")
    .single();

  if (orderError) {
    console.error("Order error:", orderError);
    return;
  }

  // Get items for this order
  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orders.id);

  if (itemError) {
    console.error("Item error:", itemError);
    return;
  }

  const orderData = {
    ...orders,
    orderNumber: orders.order_number,
    customerName: orders.customer_name,
    deliveryDate: orders.delivery_date,
    items: items.map((p) => ({
      product: p.product,
      department: p.department,
      quantity: p.quantity,
      details: p.details,
      assignedWorker: p.assigned_worker,
    })),
  };

  console.log("=== REPORT (TR) ===");
  console.log(orderService.generateVisualTable(orderData as any, "tr"));

  console.log("\n=== REPORT (RU) ===");
  console.log(orderService.generateVisualTable(orderData as any, "ru"));
}

testReport();
