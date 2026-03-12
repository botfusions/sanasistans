import { SupabaseService } from "../src/utils/supabase.service";
import * as dotenv from "dotenv";

dotenv.config();

async function debugInsert() {
  const supabase = SupabaseService.getInstance();
  const testOrderId = `test_${Date.now()}`;

  console.log(`🧪 Test Sipariş ID: ${testOrderId}`);

  try {
    // 1. Siparişi ekle
    console.log("📝 Sipariş kaydediliyor (orders)...");
    const orderData = {
      id: testOrderId,
      orderNumber: "TEST-123",
      customerName: "Debug Test",
      deliveryDate: "2026-03-20",
      status: "new",
    };

    const res1 = await supabase.upsertOrder(orderData);
    console.log("✅ orders upsert başarılı:", res1);

    // 2. Hemen kontrol et
    const { data: checkOrder, error: checkError } = await (
      supabase as any
    ).client
      .from("orders")
      .select("*")
      .eq("id", testOrderId);

    if (checkError) console.error("❌ Kayıt kontrol hatası:", checkError);
    else console.log("🔍 DB Kayıt Kontrolü (orders):", checkOrder);

    // 3. Kalem ekle
    console.log("📝 Kalem kaydediliyor (order_items)...");
    const itemData = {
      id: `${testOrderId}_0`,
      product: "Test Ürün",
      department: "Boyahane",
      quantity: 5,
      details: "Test detay",
      source: "Production",
    };

    const res2 = await supabase.upsertOrderItem(itemData, testOrderId);
    console.log("✅ order_items upsert başarılı:", res2);
  } catch (err: any) {
    console.error("🔥 HATA YAKALANDI:");
    console.error("Mesaj:", err.message);
    console.error("Detay:", err.details);
    console.error("Kod:", err.code);
  }
}

debugInsert();
