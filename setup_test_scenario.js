const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(
  "https://aejhzxvuegchakaknwts.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlamh6eHZ1ZWdjaGFrYWtud3RzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU0MDcxOSwiZXhwIjoyMDg4MTE2NzE5fQ.SDFo62u3Ss2oG0ecPXkVWS7RLo2_-XWhLMCh0rDW8rU"
);

const TID = 6030287709;

async function setupTest() {
  console.log("--- 1. Marina Kayd\u0131 (UUID ile) ---");
  const { error: staffErr } = await supabase.from("staff").upsert({
    id: crypto.randomUUID(), // Zorunlu ID
    telegram_id: TID,
    name: "Marina Han\u0131m (Test)",
    department: "Kalite Kontrol",
    role: "Admin",
    is_marina: true
  }, { onConflict: "telegram_id" });

  if (staffErr) console.error("Staff Error:", staffErr.message);
  else console.log("OK: Sizi 'Marina' (Y\u00f6netici) olarak kaydettim.");

  console.log("\n--- 2. Veriyi Kontrol Etme ---");
  const { data: item } = await supabase
    .from("order_items")
    .select("id, product, distributed_at")
    .eq("id", "TEST-ITEM-777")
    .single();

  if (item) {
    console.log("Test kalemi haz\u0131r:", item.product);
    console.log("Da\u011f\u0131t\u0131m Tarihi:", item.distributed_at);
  } else {
    console.log("UYARI: Test kalemi bulunamad\u0131!");
  }

  console.log("\n🚀 TEST HAZIR! Simdi botun Cron servisini tetikleyebilirsiniz.");
}

setupTest();
