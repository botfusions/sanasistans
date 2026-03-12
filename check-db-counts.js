const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
  try {
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("status");
    if (itemsError) throw itemsError;

    const itemCounts = items.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    console.log("Order Items Status Counts:", itemCounts);

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("status");
    if (ordersError) throw ordersError;

    const orderCounts = orders.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    console.log("Orders Status Counts:", orderCounts);
  } catch (err) {
    console.error("Error:", err);
  }
}

checkCounts();
