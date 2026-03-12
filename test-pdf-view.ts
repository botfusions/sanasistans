import * as fs from "fs";
import * as path from "path";
import { OrderService } from "./src/utils/order.service";
import * as dotenv from "dotenv";

dotenv.config();

async function testPdfView() {
  console.log("🧪 generatePDFView testi başlıyor...");
  const orderService = new OrderService();

  // Test için bir PDF lazım. Marina summary veya herhangi bir PDF.
  // Önce bir PDF üretelim
  const testItems = [
    {
      product: "Test Ürün",
      quantity: 1,
      department: "Dikişhane",
      details: "Mavi kumaş",
      source: "Stock",
      id: "test-id-1",
    },
  ];

  try {
    console.log("1. PDF üretiliyor...");
    const pdfBuffer = await orderService.generateJobOrderPDF(
      testItems as any,
      "Test Müşteri",
      "Dikişhane",
    );
    console.log("✅ PDF üretildi. Boyut:", pdfBuffer.length);

    console.log("2. generatePDFView çağrılıyor...");
    const pngBuffer = await orderService.generatePDFView(pdfBuffer);
    console.log("✅ PNG üretildi. Boyut:", pngBuffer.length);

    fs.writeFileSync("test-output.png", pngBuffer);
    console.log("💾 Sonuç test-output.png olarak kaydedildi.");
  } catch (error) {
    console.error("❌ TEST HATASI:", error);
    if (error instanceof Error) {
      console.error("Mesaj:", error.message);
      console.error("Stack:", error.stack);
    }
  }
}

testPdfView().then(() => console.log("Test bitti."));
