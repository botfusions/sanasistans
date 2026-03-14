import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

async function cleanup() {
  console.log("🧹 Test verileri temizleniyor...");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (url && key) {
    const supabase = createClient(url, key);
    console.log("🔗 Supabase bağlantısı kuruldu. Tablolar temizleniyor...");

    try {
      // Foreign key CASCADE olduğu için orders silinince diğerleri de silinir ama garanti olsun
      const { error: vmErr } = await supabase
        .from("visual_memory")
        .delete()
        .neq("id", "0");
      const { error: itemsErr } = await supabase
        .from("order_items")
        .delete()
        .neq("id", "0");
      const { error: ordersErr } = await supabase
        .from("orders")
        .delete()
        .neq("id", "0");

      if (vmErr) console.error("❌ Visual Memory silme hatası:", vmErr);
      if (itemsErr) console.error("❌ Order Items silme hatası:", itemsErr);
      if (ordersErr) console.error("❌ Orders silme hatası:", ordersErr);

      console.log("✅ Supabase tabloları temizlendi.");
    } catch (e) {
      console.error("❌ Supabase cleanup error:", e);
    }
  } else {
    console.warn(
      "⚠️ Supabase credentials bulunamadı, sadece yerel dosyalar temizlenecek.",
    );
  }

  // Yerel dosyaları temizle
  const dataDir = path.join(process.cwd(), "data");
  const filesToReset = [
    "orders.json",
    "processed_uids.json",
    "siparis_arsivi.json",
    "verilen_siparisler.log",
    "production.json",
    "tasks.json",
  ];

  for (const file of filesToReset) {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
      if (file.endsWith(".json")) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      } else {
        fs.writeFileSync(filePath, "");
      }
      console.log(`✅ ${file} temizlendi.`);
    }
  }

  // Klasörleri temizle
  const dirsToClear = ["images", "orders"];
  for (const dir of dirsToClear) {
    const dirPath = path.join(dataDir, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const curPath = path.join(dirPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          fs.rmSync(curPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(curPath);
        }
      }
      console.log(`✅ ${dir} klasörü boşaltıldı.`);
    }
  }

  console.log("🚀 Temizlik tamamlandı! Yeni test için hazırsınız.");
}

cleanup();
