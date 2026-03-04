import * as fs from "fs";
import * as path from "path";
const PDFDocument = require("pdfkit");
const { createCanvas, Image } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
import { OpenRouterService } from "./llm.service";
import { StaffService } from "./staff.service";
import { XlsxUtils, ExcelRow } from "./xlsx-utils";
import { ImageEmbeddingService } from "./image-embedding.service";
import { QdrantService } from "./qdrant.service";
import { SupabaseService } from "./supabase.service";

export interface OrderItem {
  id: string; // OrderID_Index formatında
  product: string;
  department: string;
  quantity: number;
  details: string;
  source: "Stock" | "Production" | "External";
  imageUrl?: string;
  rowIndex?: number;
  imageBuffer?: Buffer;
  imageExtension?: string;
  status: "pending" | "fabric_waiting" | "fabric_issue" | "in_production" | "qc_ready" | "shipping" | "archived";
  assignedWorker?: string;
  fabricDetails?: {
    name: string;
    amount: number; // Birim ürün için gereken miktar (metre vb.)
    arrived: boolean;
    issueNote?: string;
  };
  lastReminderAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  customerName: string;
  items: OrderItem[];
  deliveryDate: string;
  status: "new" | "processing" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
}

export class OrderService {
  private orders: OrderDetail[] = [];
  private filePath: string;
  private archivePath: string;
  private logPath: string;
  private llmService: OpenRouterService;
  private staffService: StaffService;
  private imageEmbeddingService: ImageEmbeddingService;
  private qdrantService: QdrantService;
  private supabase: SupabaseService;

  constructor() {
    this.filePath = path.join(process.cwd(), "data", "orders.json");
    this.archivePath = path.join(process.cwd(), "data", "siparis_arsivi.json");
    this.logPath = path.join(process.cwd(), "data", "verilen_siparisler.log");
    this.llmService = new OpenRouterService();
    this.staffService = new StaffService();
    this.imageEmbeddingService = new ImageEmbeddingService();
    this.qdrantService = new QdrantService();
    this.supabase = SupabaseService.getInstance();
    this.ensureDirectoryExists();
    this.loadOrdersFromSupabase(); // Başlangıçta asenkron yükleme başlar
  }

  private ensureDirectoryExists() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public async loadOrdersFromSupabase() {
    try {
      const data = await this.supabase.getActiveOrders();
      if (data) {
        this.orders = data.map((o: any) => ({
          id: o.id,
          orderNumber: o.order_number,
          customerName: o.customer_name,
          deliveryDate: o.delivery_date,
          status: o.status,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
          items: (o.order_items || []).map((i: any) => ({
            id: i.id,
            product: i.product,
            department: i.department,
            quantity: i.quantity,
            details: i.details,
            source: i.source,
            imageUrl: i.image_url,
            status: i.status,
            assignedWorker: i.assigned_worker,
            fabricDetails: {
              name: i.fabric_name,
              amount: i.fabric_amount,
              arrived: i.fabric_arrived,
              issueNote: i.fabric_issue_note
            },
            lastReminderAt: i.last_reminder_at,
            rowIndex: i.row_index,
            createdAt: i.created_at,
            updatedAt: i.updated_at
          }))
        }));
        this.saveToLocalFile(); // Yedekle
      }
    } catch (error) {
      console.error("❌ Siparişler DB'den yüklenemedi:", error);
      this.loadFromLocalFile();
    }
  }

  private loadFromLocalFile() {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, "utf-8");
        this.orders = JSON.parse(data);
      } catch (error) {
        console.error("❌ Yerel sipariş dosyası okunamadı:", error);
      }
    }
  }

  private saveToLocalFile() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.orders, null, 2));
    } catch (error) {
      console.error("❌ Sipariş verileri yerel dosyaya kaydedilemedi:", error);
    }
  }

  // Siparişi ve tüm kalemlerini Supabase'e kaydeder
  private async persistOrder(order: OrderDetail) {
    try {
      await this.supabase.upsertOrder(order);
      for (const item of order.items) {
        await this.supabase.upsertOrderItem(item, order.id);
      }
      this.saveToLocalFile(); // Yerelde de güncelle
    } catch (error) {
      console.error(`❌ Sipariş DB'ye kaydedilemedi (${order.id}):`, error);
    }
  }

  /**
   * Email veya Excel içeriğini analiz eder.
   */
  async parseAndCreateOrder(
    content: string,
    subject: string,
    isExcel: boolean = false,
    rawExcelData?: ExcelRow[]
  ): Promise<OrderDetail | null> {
    const prompt = `
      Sen bir Sandaluci Üretim Asistanısın (Ayça). Aşağıdaki ${isExcel ? "Excel verisinden (JSON formatında)" : "e-posta içeriğinden"} sipariş detaylarını çıkartmanı istiyorum.
      
      🚨 KRİTİK KURAL: Bir ürünün üretilmesi birden fazla departmanı ilgilendiriyorsa (Örn: Hem karkas üretilmeli, hem dikiş dikilmeli, hem döşeme yapılmalı), o ürünü her departman için AYRI BİRER KALEM olarak oluşturmalısın.
      Sipariş dağıtımı şu akışa göre yapılmalı:
      - Ahşap/İskelet kısmı -> Karkas Üretimi
      - Metal kısımlar -> Metal Üretimi
      - Kumaş/Deri kesim ve dikim -> Dikişhane
      - Son birleştirme ve sünger/döşeme -> Döşemehane
      - Cilalama/Boyama -> Mobilya Dekorasyon

      İçerik:
      ${content}
      
      Lütfen şu JSON formatında yanıt ver:
      {
        "orderNumber": "Email içinden veya konu başlığından varsa al, yoksa 'OTOMATIK'",
        "customerName": "Müşteri adı ve Şehir (Örn: Маржан, город Жетисай). İçerikte geçen lokasyon bilgisini mutlaka ekle.",
        "items": [
          {
            "product": "Ürün adı/kodu",
            "department": "Karkas Üretimi | Metal Üretimi | Mobilya Dekorasyon | Dikişhane | Döşemehane",
            "quantity": 1,
            "details": "Ölçü, boya kodu, işçilik detayları vb.",
            "fabricDetails": {
               "name": "Kumaş adı/kodu (Sadece Dikiş/Döşeme için)",
               "amount": 1.5
            },
            "source": "Stock | Production | External",
            "rowIndex": "Veri Excel'den geliyorsa, ilgili satırın '_rowNumber' değerini sayı olarak yaz."
          }
        ],
        "deliveryDate": "Varsa termin tarihi, yoksa 'Belirtilmedi'"
      }

      Önemli Kurallar:
      1. Kompleks bir ürünü (Örn: Döşemeli Sandalye) parçalarına böl: 1-Karkas, 2-Dikişhane, 3-Döşemehane şeklinde 3 ayrı item oluştur.
      2. Müşteri adını ve Şehir/Lokasyon bilgisini tüm içerikten (imza, başlık, metin) dikkatle çıkart.
      3. Rusça isimleri ve şehirleri (Kiril alfabesi) olduğu gibi koru.
      4. 'source' alanını ürünün durumuna göre belirle.
      5. JSON Dışında hiçbir açıklama ekleme. Sadece saf JSON döndür.
    `;

    try {
      if (isExcel) {
        console.log(`📊 Excel verisi LLM'e gönderiliyor (${content.length} karakter)`);
      }
      
      const response = await this.llmService.chat(
        prompt,
        "Sipariş ve Koordinasyon Analiz Modu.",
      );
      if (!response) return null;

      // Extract JSON block more robustly
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("❌ LLM yanıtında JSON bulunamadı:", response);
        return null;
      }

      const jsonStr = jsonMatch[0].trim();
      const parsed = JSON.parse(jsonStr);
      console.log(`🧠 [DEBUG] LLM Ayrıştırma Başarılı. Ürün Sayısı: ${parsed.items?.length || 0}`);
      console.log(`📋 [DEBUG] Ayrıştırılan Ürünler:`, JSON.stringify(parsed.items?.map((i: any) => ({ p: i.product, d: i.department, r: i.rowIndex })), null, 2));

      const order: OrderDetail = {
        id: Date.now().toString(),
        ...parsed,
        status: "new",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Kalemleri zenginleştir
      order.items = order.items.map((item, index) => ({
        ...item,
        id: `${order.id}_${index}`,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fabricDetails: item.fabricDetails ? {
          ...item.fabricDetails,
          amount: typeof (item.fabricDetails as any).amount === 'string' ? parseFloat((item.fabricDetails as any).amount.replace(/[^0-9.]/g, '')) : ((item.fabricDetails as any).amount || 0),
          arrived: false
        } : undefined
      }));

      // Görselleri işle (Eğer Excel verisi varsa)
      if (isExcel && rawExcelData) {
        const floatingImages = (rawExcelData as any).floatingImages as Buffer[] | undefined;
        let floatingIndex = 0;

        order.items.forEach(item => {
          let hasAssignedImage = false;

          if (item.rowIndex) {
            const excelMatch = rawExcelData.find(r => r._rowNumber === item.rowIndex);
            if (excelMatch && excelMatch._imageBuffer) {
              item.imageBuffer = excelMatch._imageBuffer;
              item.imageExtension = excelMatch._imageExtension || "png";
              hasAssignedImage = true;
              console.log(`✅ [DEBUG] Resim Eşleşti: Ürün=${item.product}, Satır=${item.rowIndex}`);
            }
          }

          // Satırdan resim eşleşmediyse veya satır bilgisi yoksa, floating (serbest) resimlerden birini ata
          if (!hasAssignedImage && floatingImages && floatingIndex < floatingImages.length) {
            item.imageBuffer = floatingImages[floatingIndex++];
            item.imageExtension = "png";
            console.log(`✅ [DEBUG] Serbest Resim (Fallback) Eşleşti: Ürün=${item.product}, Kalan Serbest Resim=${floatingImages.length - floatingIndex}`);
          } else if (!hasAssignedImage) {
            console.log(`⚠️ [DEBUG] Resim Bulunamadı: Ürün=${item.product}`);
          }

          // internet URL'lerini temizle - önceliğimiz her zaman Excel dosyası
          delete item.imageUrl;
        });
      }

      this.orders.push(order);
      await this.persistOrder(order);
      await this.logOrder(order);
      return order;
    } catch (error) {
      console.error("❌ Sipariş ayrıştırma hatası:", error);
      return null;
    }
  }

  /**
   * Görsel bir özet tablo oluşturur.
   */
  getVisualSummary(order: OrderDetail): string {
    let summary = `📦 *Sipariş Koordinasyon Özeti* (${order.customerName})\n`;
    summary += `--------------------------------------------\n`;

    // Gruplandırma
    const stockItems = order.items.filter((i) => i.source === "Stock");
    const prodItems = order.items.filter((i) => i.source === "Production");
    const extItems = order.items.filter((i) => i.source === "External");

    if (stockItems.length > 0) {
      summary +=
        `🏬 *STOKTAN TESLİM:*\n` +
        stockItems
          .map((i) => `- ${i.product} (${i.quantity} adet)`)
          .join("\n") +
        `\n\n`;
    }
    if (prodItems.length > 0) {
      summary +=
        `🏭 *ÜRETİME GİRECEK:*\n` +
        prodItems
          .map(
            (i) => `- ${i.product} (${i.quantity} adet) -> *${i.department}*`,
          )
          .join("\n") +
        `\n\n`;
    }
    if (extItems.length > 0) {
      summary +=
        `🛒 *DIŞ ALIM / TEDARİK:*\n` +
        extItems.map((i) => `- ${i.product} (${i.quantity} adet)`).join("\n") +
        `\n\n`;
    }

    summary += `📅 *Termin:* ${order.deliveryDate}\n`;
    summary += `🧭 _Ayça koordinasyon planını hazırladı._`;

    return summary;
  }

  getRoutingMentions(order: OrderDetail): string {
    let mentions = "";
    const departments = Array.from(
      new Set(order.items.map((i) => i.department)),
    );

    departments.forEach((dept) => {
      const staff = this.staffService.getStaffByDepartment(dept);
      if (staff.length > 0) {
        mentions += `\n📍 *${dept}*: @${staff[0].name}`;
      }
    });

    return mentions;
  }

  /**
   * Telegram Markdown karakterlerini kaçırır.
   */
  static escapeMarkdown(text: string): string {
    if (!text) return "";
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
  }

  /**
   * Estetik bir tablo formatında görsel özet oluşturur.
   */
  generateVisualTable(order: OrderDetail): string {
    const customer = OrderService.escapeMarkdown(order.customerName);
    const orderNo = OrderService.escapeMarkdown(order.orderNumber);
    const delivery = OrderService.escapeMarkdown(order.deliveryDate);

    let table = `📊 *SİPARİŞ DAĞITIM RAPORU*\n`;
    table += `━━━━━━━━━━━━━━━━━━━━\n`;
    table += `👤 *Müşteri:* ${customer}\n`;
    table += `🆔 *Sipariş:* ${orderNo}\n`;
    table += `📅 *Termin:* ${delivery}\n`;
    table += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    table += `| Ürün | Adet | Departman | Kaynak |\n`;
    table += `| :--- | :--- | :--- | :--- |\n`;

    order.items.forEach((item) => {
      const product = OrderService.escapeMarkdown(item.product);
      const dept = OrderService.escapeMarkdown(item.department);
      const sourceEmoji = item.source === "Stock" ? "📦" : item.source === "Production" ? "🏭" : "🛒";
      table += `| ${product} | ${item.quantity} | ${dept} | ${sourceEmoji} |\n`;
    });

    table += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    table += `✅ _Tüm birimlere iş emirleri iletildi._`;

    return table;
  }

  /**
   * Departman için PDF iş emri oluşturur.
   */
  async generateJobOrderPDF(items: OrderItem[], customerName: string, dept: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));

      // Fontları kaydet (Türkçe karakter desteği için)
      const fontRegular = path.join(process.cwd(), "src", "assets", "fonts", "Roboto-Regular.ttf");
      const fontBold = path.join(process.cwd(), "src", "assets", "fonts", "Roboto-Bold.ttf");
      
      try {
        if (fs.existsSync(fontRegular) && fs.existsSync(fontBold)) {
           doc.registerFont("Roboto", fontRegular);
           doc.registerFont("Roboto-Bold", fontBold);
        }
      } catch (err) {
        console.warn("⚠️ Roboto fontlari yüklenemedi. Standart font kullanılıyor.");
      }
      
      // Default fontu ayarla fallback olarak
      const defaultFont = fs.existsSync(fontRegular) ? "Roboto" : "Helvetica";
      const boldFont = fs.existsSync(fontBold) ? "Roboto-Bold" : "Helvetica-Bold";

      // --- HEADER ---
      doc.rect(30, 30, 535, 60).stroke();
      doc.font(boldFont).fontSize(22).fillColor("#1a1a1a").text("SANDALUCİ ÜRETİM İŞ EMRİ", 30, 45, { align: "center", width: 535 });
      doc.font(defaultFont).fontSize(10).fillColor("#555").text(`Departman: ${dept.toUpperCase()}`, 30, 70, { align: "center", width: 535 });
      
      doc.moveDown(3);
      const startY = 100;
      doc.font(boldFont).fontSize(11).fillColor("#000");
      doc.text(`MÜŞTERİ: `, 30, startY, { continued: true });
      doc.font(defaultFont).text(customerName);
      
      doc.font(boldFont).text(`TARİH: `, 400, startY, { continued: true });
      doc.font(defaultFont).text(new Date().toLocaleDateString("tr-TR"));
      
      doc.moveDown();
      doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke();
      doc.moveDown(0.5);

      // --- TABLE HEADER ---
      const tableTop = doc.y;
      const colWidths = [120, 150, 50, 185]; // Resim, Ürün, Adet, Detay
      const colX = [30, 150, 300, 350];
      
      doc.rect(30, tableTop, 535, 20).fill("#f2f2f2").stroke("#ccc");
      doc.fillColor("#000").font(boldFont).fontSize(10);
      doc.text("MODEL", colX[0] + 5, tableTop + 5);
      doc.text("ÜRÜN KODU / ADI", colX[1] + 5, tableTop + 5);
      doc.text("ADET", colX[2] + 5, tableTop + 5);
      doc.text("DETAYLAR", colX[3] + 5, tableTop + 5);

      let currentY = tableTop + 20;

      // --- TABLE ROWS ---
      items.forEach((item, index) => {
        const rowHeight = 110; // Her satır için sabit veya değişken yükseklik
        
        // Sayfa sonu kontrolü
        if (currentY + rowHeight > 750) {
          doc.addPage();
          currentY = 30;
        }

        // Satır çerçevesi
        doc.rect(30, currentY, 535, rowHeight).stroke("#ccc");

        // 1. Resim Sütunu
        if (item.imageBuffer) {
          try {
            doc.image(item.imageBuffer, colX[0] + 5, currentY + 5, {
              fit: [110, 100],
              align: "center",
              valign: "center"
            });
          } catch (e) {
            doc.font(defaultFont).fontSize(8).text("[Resim Hatası]", colX[0] + 5, currentY + 45);
          }
        } else {
          doc.font(boldFont).fontSize(8).fillColor("#999").text("GÖRSEL YOK", colX[0] + 30, currentY + 45);
        }

        // 2. Ürün Adı
        doc.fillColor("#000").font(boldFont).fontSize(10);
        doc.text(item.product, colX[1] + 5, currentY + 10, { width: colWidths[1] - 10 });

        // 3. Adet
        doc.font(defaultFont).fontSize(12).text(item.quantity.toString(), colX[2] + 5, currentY + 10, { width: colWidths[2] - 10, align: "center" });

        // 4. Detaylar
        doc.font(defaultFont).fontSize(9).fillColor("#333");
        doc.text(item.details, colX[3] + 5, currentY + 10, { width: colWidths[3] - 10 });

        // Dikey çizgiler
        doc.moveTo(colX[1], currentY).lineTo(colX[1], currentY + rowHeight).stroke("#ccc");
        doc.moveTo(colX[2], currentY).lineTo(colX[2], currentY + rowHeight).stroke("#ccc");
        doc.moveTo(colX[3], currentY).lineTo(colX[3], currentY + rowHeight).stroke("#ccc");

        currentY += rowHeight;
      });

      // Footer
      const footerY = 780;
      doc.fontSize(8).fillColor("#999").text("Sandaluci Akıllı Üretim Koordinasyon Sistemi tarafından oluşturulmuştur.", 30, footerY, { align: "center", width: 535 });

      doc.end();
    });
  }

  /**
   * Sipariş formunu tarihli klasöre arşivler.
   */
  async archiveOrderFile(fileName: string, content: Buffer): Promise<string> {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const archiveDir = path.join(process.cwd(), "data", "orders", today);
    
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const filePath = path.join(archiveDir, fileName);
    fs.writeFileSync(filePath, content);
    console.log(`📂 Sipariş formu arşivlendi: ${filePath}`);
    return filePath;
  }

  /**
   * Oluşturulan PDF iş emrini yerel klasöre arşivler.
   */
  async archivePDF(deptName: string, pdfBuffer: Buffer): Promise<string> {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const pdfDir = path.join(process.cwd(), "data", "orders", today, "pdfs");
    
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const safeDeptName = deptName.replace(/[^a-z0-9]/gi, "_").toUpperCase();
    const fileName = `is_emri_${safeDeptName}_${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);
    
    fs.writeFileSync(filePath, pdfBuffer);
    console.log(`📂 PDF İş Emri arşivlendi: ${filePath}`);
    return filePath;
  }

  /**
   * Siparişi log dosyasına kaydeder.
   */
  private async logOrder(order: OrderDetail) {
    const timestamp = new Date().toLocaleString("tr-TR");
    let logEntry = `[${timestamp}] YENİ SİPARİŞ: ${order.orderNumber} - Müşteri: ${order.customerName}\n`;
    
    order.items.forEach(item => {
      logEntry += `  - ${item.product} | ${item.quantity} Adet | Departman: ${item.department} | Kaynak: ${item.source}\n`;
    });
    
    logEntry += `------------------------------------------------------------\n`;

    try {
      fs.appendFileSync(this.logPath, logEntry);
      console.log(`📝 Sipariş loglandı: ${order.orderNumber}`);
    } catch (error) {
      console.error("❌ Log yazma hatası:", error);
    }
  }

  /**
   * Siparişi arşive taşır.
   */
  public async archiveToCompleted(orderId: string): Promise<boolean> {
    const orderIndex = this.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return false;

    const order = this.orders[orderIndex];
    order.status = "completed";

    try {
      // Arşiv dosyasını oku/yükle
      let archive: OrderDetail[] = [];
      if (fs.existsSync(this.archivePath)) {
        archive = JSON.parse(fs.readFileSync(this.archivePath, "utf-8"));
      }

      archive.push(order);
      fs.writeFileSync(this.archivePath, JSON.stringify(archive, null, 2));

      // Mevcut listeden sil
      this.orders.splice(orderIndex, 1);
      
      // DB'de statüyü güncelle (id bazlı)
      await this.supabase.upsertOrder(order);
      this.saveToLocalFile();
      
      console.log(`✅ Sipariş arşive taşındı: ${order.orderNumber}`);
      return true;
    } catch (error) {
      console.error("❌ Arşivleme hatası:", error);
      return false;
    }
  }

  /**
   * Departman için detaylı metin görünümü oluşturur.
   */
  public generateDeptView(items: OrderItem[], customerName: string, dept: string): string {
    const today = new Date().toLocaleDateString("tr-TR");
    const now = new Date().toLocaleTimeString("tr-TR");
    
    let view = `📑 *${dept.toUpperCase()} İŞ EMRİ DETAYI*\n`;
    view += `━━━━━━━━━━━━━━━━━━━━\n`;
    view += `👤 *Müşteri:* ${OrderService.escapeMarkdown(customerName)}\n`;
    view += `📅 *Tarih:* ${today} | ${now}\n`;
    view += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    items.forEach((item, idx) => {
      view += `${idx + 1}. *${OrderService.escapeMarkdown(item.product)}*\n`;
      view += `   🔢 Adet: ${item.quantity}\n`;
      view += `   📝 Detay: ${OrderService.escapeMarkdown(item.details || "Belirtilmedi")}\n`;
      view += `   📍 Kaynak: ${item.source === "Stock" ? "Stok" : item.source === "Production" ? "Üretim" : "Dış Alım"}\n\n`;
    });

    view += `━━━━━━━━━━━━━━━━━━━━\n`;
    view += `⚠️ _Bu bildirim sistem tarafından otomatik kayıt altına alınmıştır._`;
    
    return view;
  }

  /**
   * Ürün görsellerini görsel hafızaya kaydeder.
   */
  async saveToVisualMemory(order: OrderDetail) {
    for (const item of order.items) {
      if (item.imageBuffer) {
        try {
          console.log(`🧠 Görsel hafıza işleniyor: ${item.product}`);
          const vector = await this.imageEmbeddingService.generateImageEmbedding(
            item.imageBuffer,
            item.imageExtension || "jpg"
          );

          await this.qdrantService.upsertImage(
            `${order.id}_${item.product}_${Date.now()}`,
            vector,
            {
              productName: item.product,
              customerName: order.customerName,
              orderNo: order.orderNumber,
              tags: [item.department, item.source]
            }
          );
        } catch (error) {
          console.error(`❌ Görsel hafıza hatası (${item.product}):`, error);
        }
      }
    }
  }

  /**
   * PDF Buffer'ını görsel bir PNG Buffer'ına dönüştürür (Screenshot gibi)
   */
  async generatePDFView(pdfBuffer: Buffer): Promise<Buffer> {
    try {
      console.log("[OrderService] PDF Görünümü (Screenshot) oluşturuluyor...");
      
      const uint8Array = new Uint8Array(pdfBuffer);
      
      // Font ve Karakter eşleşmeleri için CMap ve StandardFont yollarını belirle
      // Windows'ta backslash'leri forward slash'e çevirmek ve file:/// kullanmak gerekir
      const nodeModulesPath = path.join(process.cwd(), "node_modules", "pdfjs-dist").replace(/\\/g, '/');
      const cMapUrl = `file:///${nodeModulesPath}/cmaps/`;
      const standardFontDataUrl = `file:///${nodeModulesPath}/standard_fonts/`;

      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        useSystemFonts: false, // Sistem fontlarını kullanma, PDF içindekileri veya standard_fonts'u kullan
        disableFontFace: true, // Node ortamında font-face yükleme sorunlarını önleyebilir
        cMapUrl: cMapUrl,
        cMapPacked: true,
        standardFontDataUrl: standardFontDataUrl,
        isEvalSupported: false // Node.js kısıtlamaları için
      });
      
      const pdfDocument = await loadingTask.promise;
      
      // İlk sayfayı al
      const page = await pdfDocument.getPage(1);
      
      // Okunabilirlik için scale (3.0 yüksek kalite sağlar)
      const scale = 3.0;
      
      // Roboto fontlarını Canvas'a kaydet (Manual yedek olarak)
      const { registerFont } = require('canvas');
      const regularPath = path.join(process.cwd(), "src", "assets", "fonts", "Roboto-Regular.ttf");
      const boldPath = path.join(process.cwd(), "src", "assets", "fonts", "Roboto-Bold.ttf");
      
      if (fs.existsSync(regularPath)) registerFont(regularPath, { family: 'Roboto' });
      if (fs.existsSync(boldPath)) registerFont(boldPath, { family: 'Roboto', weight: 'bold' });

      const viewport = page.getViewport({ scale });
      
      // Canvas oluştur
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Arkaplanı beyaz yap
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Render ayarları
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      console.log("[OrderService] PDF başarıyla resme dönüştürüldü (Scale: 3.0).");
      return canvas.toBuffer('image/png');
    } catch (error) {
      console.error("[OrderService] PDF Görünümü oluşturma hatası:", error);
      throw error;
    }
  }

  /**
   * Belirli bir sipariş kaleminin durumunu ve işçisini günceller.
   */
  public async updateItemStatus(itemId: string, status: OrderItem["status"]) {
    for (const order of this.orders) {
      const item = order.items.find((i) => i.id === itemId);
      if (item) {
        item.status = status;
        item.updatedAt = new Date().toISOString();
        order.updatedAt = new Date().toISOString();
        
        // Supabase güncelle
        await this.supabase.upsertOrderItem(item, order.id);
        this.saveToLocalFile();
        return true;
      }
    }
    return false;
  }

  /**
   * Döşeme ekibi için işçi ataması yapar.
   */
  public async assignWorkerToItem(itemId: string, workerName: string) {
    for (const order of this.orders) {
      const item = order.items.find((i) => i.id === itemId);
      if (item) {
        item.assignedWorker = workerName;
        item.status = "in_production";
        item.updatedAt = new Date().toISOString();
        order.updatedAt = new Date().toISOString();
        
        // Supabase güncelle
        await this.supabase.upsertOrderItem(item, order.id);
        this.saveToLocalFile();
        return true;
      }
    }
    return false;
  }

  /**
   * Kumaş durumunu günceller ve not ekler.
   */
  public async updateFabricStatus(itemId: string, arrived: boolean, note?: string) {
    for (const order of this.orders) {
      const item = order.items.find((i) => i.id === itemId);
      if (item && item.fabricDetails) {
        item.fabricDetails.arrived = arrived;
        if (note) item.fabricDetails.issueNote = note;
        item.status = arrived ? "pending" : "fabric_issue";
        item.updatedAt = new Date().toISOString();
        order.updatedAt = new Date().toISOString();
        
        // Supabase güncelle
        await this.supabase.upsertOrderItem(item, order.id);
        this.saveToLocalFile();
        return true;
      }
    }
    return false;
  }

  public getOrders() {
    return this.orders;
  }

  public getOrderItemById(itemId: string): { order: OrderDetail, item: OrderItem } | null {
    for (const order of this.orders) {
      const item = order.items.find(i => i.id === itemId);
      if (item) return { order, item };
    }
    return null;
  }
}
