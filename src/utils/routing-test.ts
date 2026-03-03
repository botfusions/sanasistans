import { OrderService } from "./order.service";
import { XlsxUtils } from "./xlsx-utils";
import { StaffService } from "./staff.service";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import pino from "pino";

dotenv.config();
const logger = pino({ name: "RoutingTest" });

async function runRoutingTest() {
  const excelPath = path.resolve(process.cwd(), "docs", "SIPARIS FORMU-DENEME SIPARIS.xlsx");
  
  if (!fs.existsSync(excelPath)) {
    logger.error(`❌ Excel dosyası bulunamadı: ${excelPath}`);
    return;
  }

  logger.info(`📂 Excel okunuyor: ${excelPath}`);
  const excelBuffer = fs.readFileSync(excelPath);
  
  const staffService = new StaffService();
  const orderService = new OrderService();
  
  // 1. Excel'i ayrıştır
  logger.info("⏳ Excel ayrıştırılıyor...");
  const rows = await XlsxUtils.parseExcel(excelBuffer);
  logger.info(`✅ ${rows.length} satır ayrıştırıldı.`);
  
  // HAM VERİ KONTROLÜ (Kullanıcı uyarısı üzerine dosyaya yazıyoruz)
  const dumpPath = path.join(process.cwd(), "data", "tests", "excel_dump.json");
  if (!fs.existsSync(path.dirname(dumpPath))) fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
  fs.writeFileSync(dumpPath, JSON.stringify(rows, null, 2));
  logger.info(`📄 HAM EXCEL VERİSİ KAYDEDİLDİ: ${dumpPath}`);

  // 2. Sipariş objesini oluştur (LLM kullanır)
  // Veriyi sadeleştir: Sadece ürün, detay ve miktar bilgilerini gönder
  const simplifiedData = rows
    .filter(r => r && typeof r === 'object')
    .map(r => ({
      productName: r["Ürün Adı"] || r["URUN_ADI"] || r["ÜRÜN"] || r["Col1"] || "Bilinmeyen Ürün",
      details: r["Detay"] || r["ACIKLAMA"] || r["Col2"] || "Detay yok",
      quantity: r["Adet"] || r["Col3"] || 1,
      rowIndex: r._rowNumber // XlsxUtils tarafından atanan satır no
    }));

  const excelDataString = JSON.stringify(simplifiedData);
  logger.info(`🤖 LLM için ${simplifiedData.length} ürün satırı hazırlandı.`);
  
  try {
    const orderDetail = await orderService.parseAndCreateOrder(
      excelDataString, 
      "DENEME SIPARISI - EXCEL TEST", 
      true, // isExcel
      rows // Ham veriyi pasla
    );

    if (!orderDetail) {
      logger.error("❌ LLM'den sipariş verisi döndürülemedi.");
      return;
    }

    logger.info(`✅ Sipariş oluşturuldu: ${orderDetail.customerName}`);
    // logger.info(`📦 Sipariş Detayı: ${JSON.stringify(orderDetail, null, 2)}`);

    // 3. Departmanlara dağıtım simülasyonu
    const departments = Array.from(new Set(orderDetail.items.map((i: any) => i.department)));
    logger.info(`📡 Bulunan Departmanlar: ${departments.join(", ")}`);

    for (const dept of departments) {
      const deptItems = orderDetail.items.filter(
        (item: any) => item.department.toLowerCase() === dept.toLowerCase()
      );

      if (deptItems.length > 0) {
        logger.info(`📍 [${dept}] Departmanı işleniyor... (${deptItems.length} ürün)`);

        // Resimlerin eşleştiğini doğrula
        deptItems.forEach((item: any) => {
          if (item.imageBuffer) {
            logger.info(`🖼️ Görsel BAŞARIYLA eşleşti: ${item.product} (Row: ${item.rowIndex})`);
          } else {
            logger.warn(`⚠️ Görsel eksik: ${item.product} (Row: ${item.rowIndex})`);
          }
        });

        // PDF Üretimi
        const pdfFileName = `JOB_ORDER_${dept.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
        const pdfPath = path.join(process.cwd(), "data", "tests", pdfFileName);
        
        const testDataDir = path.dirname(pdfPath);
        if (!fs.existsSync(testDataDir)) {
          fs.mkdirSync(testDataDir, { recursive: true });
        }

        logger.info(`📄 PDF üretiliyor: ${pdfFileName}`);
        const pdfBuffer = await orderService.generateJobOrderPDF(
          deptItems,
          orderDetail.customerName,
          dept
        );

        fs.writeFileSync(pdfPath, pdfBuffer);
        logger.info(`✅ PDF kaydedildi: ${pdfPath}`);
      }
    }

    logger.info("🏁 Test başarıyla tamamlandı.");

  } catch (error: any) {
    logger.error({ error: error.message }, "❌ Test sırasında hata oluştu");
  }
}

runRoutingTest();
