import { SupabaseService } from "../src/utils/supabase.service";

async function cleanup() {
  console.log("🚀 Supabase temizleme işlemi başlatılıyor...");
  const supabase = SupabaseService.getInstance();

  try {
    // 1. Mevcut kayıt sayılarını al
    const { data: ordersBefore, error: err1 } = await (supabase as any).client
      .from("orders")
      .select("id", { count: "exact" });

    if (err1) throw err1;
    console.log(`📊 Silme öncesi sipariş sayısı: ${ordersBefore?.length || 0}`);

    const { data: itemsBefore, error: err2 } = await (supabase as any).client
      .from("order_items")
      .select("id");

    if (err2) {
      console.error("❌ order_items count check error:", err2);
      throw err2;
    }
    console.log(`📊 Silme öncesi ürün sayısı: ${itemsBefore?.length || 0}`);

    // 2. Temizleme işlemi
    console.log(
      "🧹 Tüm veriler siliniyor (Siparişler, Ürünler, Görsel Bellek)...",
    );

    await (supabase as any).client
      .from("visual_memory")
      .delete()
      .neq("id", "none");
    const { error: deleteError } = await (supabase as any).client
      .from("orders")
      .delete()
      .neq("id", "none");

    if (deleteError) {
      console.error("❌ Silme hatası:", deleteError);
      return;
    }

    // 3. Sonuçları kontrol et
    const { data: ordersAfter } = await (supabase as any).client
      .from("orders")
      .select("id");

    const { data: itemsAfter } = await (supabase as any).client
      .from("order_items")
      .select("id");

    const { data: visualAfter } = await (supabase as any).client
      .from("visual_memory")
      .select("id");

    const { data: staffAfter } = await (supabase as any).client
      .from("staff")
      .select("id");

    console.log("✅ Temizleme tamamlandı.");
    console.log(`📊 Kalan sipariş: ${ordersAfter?.length || 0}`);
    console.log(`📊 Kalan ürün: ${itemsAfter?.length || 0}`);
    console.log(`📊 Kalan görsel bellek: ${visualAfter?.length || 0}`);
    console.log(`📊 Kalan personel: ${staffAfter?.length || 0}`);
  } catch (error) {
    console.error("💥 Beklenmedik hata:", error);
  }
}

cleanup();
