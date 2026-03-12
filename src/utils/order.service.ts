import * as fs from "fs";
import * as path from "path";
const PDFDocument = require("pdfkit");
const { createCanvas } = require("canvas");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
import { pathToFileURL } from "url";
import { OpenRouterService } from "./llm.service";
import { StaffService } from "./staff.service";
import { ExcelRow, XlsxUtils } from "./xlsx-utils";
import { ImageEmbeddingService } from "./image-embedding.service";
import { SupabaseService } from "./supabase.service";
import { t, Language } from "./i18n";
import { pino } from "pino";

const logger = pino();

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
  status:
    | "bekliyor"
    | "uretimde"
    | "boyada"
    | "dikiste"
    | "dosemede"
    | "hazir"
    | "sevk_edildi"
    | "arsivlendi";
  assignedWorker?: string;
  distributedAt?: string; // İş emri dağıtım tarihi (takip zamanlayıcı için)
  fabricDetails?: {
    name: string;
    amount: number;
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
  isDuplicate?: boolean; // Mükerrer sipariş kontrolü için
  createdAt: string;
  updatedAt: string;
}

export class OrderService {
  private orders: OrderDetail[] = [];
  private filePath: string;

  /**
   * Levenshtein mesafesi hesaplayan metin benzerliği hesaplama
   * 0.0 (tamamen farklı) ile 1.0 (tamamen aynı) arasında değer döndürür
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    // Boş string kontrolü
    if (maxLen === 0) return 1;

    // Levenshtein mesafesi hesapla
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // Silme
          matrix[i][j - 1] + 1, // Ekleme
          matrix[i - 1][j - 1] + cost, // Değiştirme
        );
      }
    }

    const distance = matrix[len1][len2];
    return 1 - distance / maxLen;
  }
  private archivePath: string;
  private logPath: string;
  private llmService: OpenRouterService;
  private staffService: StaffService;
  private imageEmbeddingService: ImageEmbeddingService;
  private supabase: SupabaseService;

  constructor() {
    this.filePath = path.join(process.cwd(), "data", "orders.json");
    this.archivePath = path.join(process.cwd(), "data", "siparis_arsivi.json");
    this.logPath = path.join(process.cwd(), "data", "verilen_siparisler.log");
    this.llmService = new OpenRouterService();
    this.staffService = StaffService.getInstance();
    this.imageEmbeddingService = new ImageEmbeddingService();
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
            status: i.status || "bekliyor",
            assignedWorker: i.assigned_worker,
            fabricDetails: {
              name: i.fabric_name,
              amount: i.fabric_amount,
              arrived: i.fabric_arrived,
              issueNote: i.fabric_issue_note,
            },
            lastReminderAt: i.last_reminder_at,
            rowIndex: i.row_index,
            createdAt: i.created_at,
            updatedAt: i.updated_at,
          })),
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

  // Departman ismini i18n üzerinden çevirir (varsayılan: ru)
  public getDeptTranslation(dept: string, lang: Language = "ru"): string {
    const mapping: Record<string, string> = {
      "Karkas Üretimi": "dept_karkas",
      "Metal Üretimi": "dept_metal",
      "Mobilya Dekorasyon": "dept_mobilya",
      Dikişhane: "dept_sewing",
      Döşemehane: "dept_upholstery",
      Boyahane: "dept_paint",
      Kumaş: "dept_fabric",
    };
    const key = mapping[dept];
    return key ? t(key, lang) : dept;
  }

  /**
   * Email veya Excel içeriğini analiz eder.
   */
  async parseAndCreateOrder(
    subject: string,
    content: string,
    uid: string,
    attachments?: any[],
  ): Promise<OrderDetail | null> {
    try {
      let fullContent = `Konu: ${subject}\n\nİçerik:\n${content}`;
      let isExcel = false; // Flag to indicate if Excel data was processed
      let rawExcelData: ExcelRow[] | undefined; // To store parsed Excel data if any

      // Excel eklerini işle - XlsxUtils kullan (resimleri de alır)
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          if (
            attachment.contentType ===
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            attachment.filename?.endsWith(".xlsx")
          ) {
            try {
              // XlsxUtils kullan - resimleri de içerir
              rawExcelData = await XlsxUtils.parseExcel(attachment.content);

              // Tablo formatında içerik oluştur (LLM için)
              const tableContent = XlsxUtils.formatToTable(rawExcelData);
              fullContent += `\n\n--- EK DOSYA İÇERİĞİ (${attachment.filename}) ---\n${tableContent}`;
              isExcel = true;
              console.log(
                `📊 [DEBUG] Excel eki XlsxUtils ile okundu: ${attachment.filename}, ${rawExcelData.length} satır`,
              );
            } catch (err) {
              console.error(
                `❌ [DEBUG] Excel okuma hatası (${attachment.filename}):`,
                err,
              );
            }
          }
        }
      }

      const prompt = `
      Sen profesyonel bir Sandaluci Üretim Planlama Asistanısın. Görevin, gelen veriyi (EXCEL tablosu veya E-POSTA gövdesi) analiz ederek departmanlara göre hatasız parçalamak ve ÇİFT DİLLİ (Türkçe ve Rusça) sipariş verisi oluşturmaktır.
      
      🚨 ÖNEMLİ: Girdi bir E-POSTA metniyse (özellikle "Fwd:" ile başlayan forwarded mailler), mailin alt kısımlarındaki asıl sipariş detaylarını bul ve odaklan. 
      E-postanın en üstündeki yönlendirme bilgilerini (From, Date, Subject) geçerek, asıl mesaj gövdesindeki sipariş kalemlerini (Ürün, Adet, Kumaş, Boya vb.) tespit et.
      
      🚨 DİL KURALI: 
      - Çalışanlar Rusça, patron (Barış Bey) Türkçe bilmektedir.
      - "product" ve "details" alanlarını HER ZAMAN "[TR] ... / [RU] ..." formatında doldur.
      - Örn: "product": "[TR] 274 Sandalye / [RU] 274 Стул"
      - Örn: "details": "[TR] Kumaş: Dorian 12 / [RU] Ткань: Dorian 12"

      DEPARTMAN ATAMA KURALLARI:
      - İSKELET/KARKAS: Eğer "YAPILACAK", "İSKELET YAPILACAK" veya karkas gereksinimi varsa -> "Karkas Üretimi".
      - DİKİŞ/DÖŞEME: Kumaş kaplama, dikiş veya döşeme notu varsa -> HEM "Dikişhane" HEM DE "Döşemehane" için ayrı kalemler oluştur.
      - KUMAŞ TEDARİK: Kumaş adı/kodu varsa -> "Kumaş" departmanına Marina Hanım için ayrı bir kalem oluştur. 
      - BOYA/CİLA: Boya rengi veya cila notu varsa -> "Boyahane" departmanına kalem oluştur.
      - DİĞER: "Metal Üretimi", "Mobilya Dekorasyon".

      🚨 KRİTİK KURALLAR:
      1. ÜRÜN PARÇALAMA: Her bir departman işi için AYRI kalem (item) oluştur.
      2. DETAYLARIN KORUNMASI: Kumaş, boya ve teknik notları ilgili TÜM kalemlerin "details" kısmına ekle.
      3. FABRIC VE PAINT ALANLARI: "fabricDetails" ve "paintDetails" nesnelerini doldur.
      4. MÜŞTERİ BİLGİSİ: "customerName" alanına müşteri adını ve varsa proje adını yaz. Mail içinde "Müşteri:", "Proje:" veya "Ad Soyad:" gibi ifadeleri ara.
      
      İÇERİK:
      ${fullContent}
      
      SADECE SAF JSON DÖNDÜR:
      {
        "orderNumber": "...",
        "customerName": "...",
        "items": [
          {
            "product": "[TR] ... / [RU] ...",
            "department": "...",
            "quantity": 0,
            "details": "[TR] ... / [RU] ...",
            "fabricDetails": {"name": "...", "amount": 0},
            "paintDetails": {"name": "..."},
            "source": "Production",
            "rowIndex": 0
          }
        ],
        "deliveryDate": "..."
      }
    `;

      console.log("--- RAW MAIL CONTENT START ---");
      console.log(content);
      console.log("--- RAW MAIL CONTENT END ---");

      if (isExcel) {
        console.log(
          `📊 Excel verisi LLM'e gönderiliyor (${fullContent.length} karakter)`,
        );
      }

      console.log(`🧠 [DEBUG] LLM Parametreleri:`, {
        subject,
        contentLength: fullContent.length,
        contentPreview: fullContent.substring(0, 500),
      });

      const response = await this.llmService.chat(prompt, fullContent);

      console.log(
        `[DEBUG] LLM Raw Response Received: ${response?.substring(0, 500)}...`,
      );
      if (!response) return null;

      // Extract JSON block more robustly
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("❌ LLM yanıtında JSON bulunamadı. Ham yanıt:", response);
        return null;
      }

      const jsonStr = jsonMatch[0].trim();
      let parsed;
      try {
        // Log candidate for debugging if needed (shortened)
        // console.log("🔍 JSON Adayı:", jsonStr.substring(0, 500) + "...");

        let cleanJsonStr = jsonStr
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
          .replace(/\\+"/g, '"') // Fix double escapes
          .trim();

        // Ensure we only have what's between { and }
        const firstBrace = cleanJsonStr.indexOf("{");
        const lastBrace = cleanJsonStr.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
          cleanJsonStr = cleanJsonStr.substring(firstBrace, lastBrace + 1);
        }

        parsed = JSON.parse(cleanJsonStr);
      } catch (parseErr) {
        console.error("❌ LLM JSON parse hatası:", parseErr);
        console.error("📄 [KRİTİK] Ham Yanıt (Hata anı):", jsonStr); // FULL RESPONSE FOR DEBUGGING

        if (parseErr instanceof SyntaxError) {
          const match = parseErr.message.match(/at position (\d+)/);
          if (match) {
            const pos = parseInt(match[1]);
            const context = jsonStr.substring(
              Math.max(0, pos - 50),
              Math.min(jsonStr.length, pos + 50),
            );
            console.error(`📍 Hata konumu (${pos}):\n...${context}...`);
          }
        }
        return null;
      }

      console.log(
        `🧠 [DEBUG] LLM Ayrıştırma Başarılı. Ürün Sayısı: ${parsed.items?.length || 0}`,
      );
      console.log(
        `📋 [DEBUG] Ayrıştırılan Ürünler:`,
        JSON.stringify(
          parsed.items?.map((i: any) => ({
            p: i.product,
            d: i.department,
            r: i.rowIndex,
          })),
          null,
          2,
        ),
      );

      // 🚨 İÇERİK BAZLI MÜKERRER KONTROLÜ
      // Aynı müşteri + benzer ürün kombinasyonunu kontrol et
      const allOrders = this.orders;
      const customerName = (parsed.customerName || "").toLowerCase().trim();
      const newProducts = (parsed.items || [])
        .map((i: any) =>
          (i.product || "")
            .toLowerCase()
            .replace(/\[tr\].*?\[ru\].*?/gi, "")
            .trim(),
        )
        .sort()
        .join(",");

      // Son 24 saat içindeki aynı müşteri siparişlerini kontrol et
      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      const recentOrders = allOrders.filter(
        (o: OrderDetail) => o.createdAt > oneDayAgo,
      );

      for (const existingOrder of recentOrders) {
        const existingCustomerName = (existingOrder.customerName || "")
          .toLowerCase()
          .trim();
        const existingProducts = (existingOrder.items || [])
          .map((i: any) =>
            (i.product || "")
              .toLowerCase()
              .replace(/\[tr\].*?\[ru\].*?/gi, "")
              .trim(),
          )
          .sort()
          .join(",");

        // Müşteri adı benzer mi (%80) ve ürün kombinasyonu benzer mi (%70)?
        const customerSimilarity = this.calculateSimilarity(
          customerName,
          existingCustomerName,
        );
        const productSimilarity = this.calculateSimilarity(
          newProducts,
          existingProducts,
        );

        if (customerSimilarity > 0.8 && productSimilarity > 0.7) {
          logger.warn(
            `⚠️ Mükerrer sipariş tespit edildi! Müşteri: "${customerName}" → Mevcut: "${existingCustomerName}" (Benzerlik: ${Math.round(customerSimilarity * 100)}%)`,
          );
          logger.warn(
            `⚠️ Ürün kombinasyonu benzerliği: ${Math.round(productSimilarity * 100)}%`,
          );
          return { ...existingOrder, isDuplicate: true }; // Mevcut siparişi bayrakla döndür
        }
      }

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
        status: "bekliyor",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fabricDetails: item.fabricDetails
          ? {
              ...item.fabricDetails,
              amount:
                typeof (item.fabricDetails as any).amount === "string"
                  ? parseFloat(
                      (item.fabricDetails as any).amount.replace(
                        /[^0-9.]/g,
                        "",
                      ),
                    )
                  : (item.fabricDetails as any).amount || 0,
              arrived: false,
            }
          : undefined,
      }));

      // Görselleri işle (Eğer Excel verisi varsa)
      if (isExcel && rawExcelData) {
        const floatingImages = (rawExcelData as any).floatingImages as
          | Buffer[]
          | undefined;
        let floatingIndex = 0;

        order.items.forEach((item) => {
          let hasAssignedImage = false;

          if (item.rowIndex) {
            const excelMatch = rawExcelData.find(
              (r) => r._rowNumber === item.rowIndex,
            );
            if (excelMatch && excelMatch._imageBuffer) {
              item.imageBuffer = excelMatch._imageBuffer;
              item.imageExtension = excelMatch._imageExtension || "png";
              hasAssignedImage = true;
              console.log(
                `✅ [DEBUG] Resim Eşleşti: Ürün=${item.product}, Satır=${item.rowIndex}`,
              );
            }
          }

          // Satırdan resim eşleşmediyse veya satır bilgisi yoksa, floating (serbest) resimlerden birini ata
          if (
            !hasAssignedImage &&
            floatingImages &&
            floatingIndex < floatingImages.length
          ) {
            item.imageBuffer = floatingImages[floatingIndex++];
            item.imageExtension = "png";
            console.log(
              `✅ [DEBUG] Serbest Resim (Fallback) Eşleşti: Ürün=${item.product}, Kalan Serbest Resim=${floatingImages.length - floatingIndex}`,
            );
          } else if (!hasAssignedImage) {
            console.log(`⚠️ [DEBUG] Resim Bulunamadı: Ürün=${item.product}`);
          }

          // internet URL'lerini temizle - önceliğimiz her zaman Excel dosyası
          delete item.imageUrl;
        });
      }

      await this.persistOrder(order);

      // Görsel hafıza - Artık ana sipariş DB'de olduğu için güvenle çalışabilir
      try {
        await this.saveToVisualMemory(order);
      } catch (e) {
        console.error("⚠️ Görsel hafıza kaydı atlandı (hata):", e);
      }

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
  getVisualSummary(order: OrderDetail, lang: Language = "tr"): string {
    const title = t("summary_title", lang);
    let summary = `${title} (${order.customerName})\n`;
    summary += `--------------------------------------------\n`;

    // Gruplandırma
    const stockItems = order.items.filter((i) => i.source === "Stock");
    const prodItems = order.items.filter((i) => i.source === "Production");
    const extItems = order.items.filter((i) => i.source === "External");

    if (stockItems.length > 0) {
      summary +=
        `${t("stock_delivery", lang)}\n` +
        stockItems
          .map((i) => `- ${i.product} (${i.quantity} adet)`)
          .join("\n") +
        `\n\n`;
    }
    if (prodItems.length > 0) {
      summary +=
        `${t("production_entry", lang)}\n` +
        prodItems
          .map(
            (i) =>
              `- ${i.product} (${i.quantity} adet) -> *${this.getDeptTranslation(i.department, lang)}* (${i.department})`,
          )
          .join("\n") +
        `\n\n`;
    }
    if (extItems.length > 0) {
      summary +=
        `${t("external_purchase", lang)}\n` +
        extItems.map((i) => `- ${i.product} (${i.quantity} adet)`).join("\n") +
        `\n\n`;
    }

    summary += `📅 *${t("delivery_label", lang)}:* ${order.deliveryDate}\n`;
    summary += `${t("coordinator_note", lang)}`;

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
        const ruDept = this.getDeptTranslation(dept, "ru");
        mentions += `\n📍 *${ruDept}* (${dept}): @${staff[0].name}`;
      }
    });

    return mentions;
  }

  /**
   * Telegram HTML karakterlerini kaçırır.
   */
  static escapeHTML(text: string): string {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Telegram Markdown karakterlerini kaçırır.
   */
  static escapeMarkdown(text: string): string {
    if (!text) return "";
    // Telegram Markdown (v1) için sadece *, _, [, ` kaçırılmalıdır.
    // -, ., ! gibi karakterleri kaçırmak ekranda gereksiz \ çıkarır.
    return text.replace(/([*_\[`])/g, "\\$1");
  }

  /**
   * Estetik bir tablo formatında görsel özet oluşturur.
   * Boss için TR, genel için RU başlıklar kullanır.
   */
  generateVisualTable(order: OrderDetail, lang: Language = "ru"): string {
    const customer = OrderService.escapeHTML(order.customerName);
    const orderNo = OrderService.escapeHTML(order.orderNumber);
    const delivery = OrderService.escapeHTML(order.deliveryDate);

    const title = t("report_title", lang);
    const labelCustomer = t("customer_label", lang);
    const labelOrder = t("order_label", lang);
    const labelTermin = t("delivery_label", lang);
    const labelProduct = t("product_label", lang);
    const labelDept = t("dept_label", lang);
    const labelWorker = t("worker_label", lang);
    const labelDetails = t("details_label", lang);

    let table = `<b>${title}</b>\n`;
    table += `👤 ${labelCustomer}: <code>${customer}</code>\n`;
    table += `📂 ${labelOrder}: <code>${orderNo}</code>\n`;
    table += `📅 ${labelTermin}: <b>${delivery}</b>\n`;
    table += `━━━━━━━━━━━━━━━━━━━━\n`;
    table += `📦 <b>${labelProduct}</b>\n\n`;

    order.items.forEach((item, index) => {
      const product = OrderService.escapeHTML(item.product);
      const dept = OrderService.escapeHTML(
        this.getDeptTranslation(item.department, lang),
      );
      const worker = OrderService.escapeHTML(
        item.assignedWorker || t("dist_not_assigned", lang),
      );
      const details = item.details
        ? OrderService.escapeHTML(item.details)
        : "";

      table += `<b>${index + 1}.</b> ${product}\n`;
      table += `   👉 <i>${dept}</i>\n`;
      table += `   👷 <b>Personel:</b> ${worker}\n`;
      if (details) table += `   📝 <b>Not:</b> ${details}\n`;
      table += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
    });

    table += `\n⚠️ <i>${t("pdf_footer", lang)}</i>`;

    return table;
  }
  async generateMarinaSummaryPDF(order: OrderDetail): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));

      const fontRegular = path.join(
        process.cwd(),
        "src",
        "assets",
        "fonts",
        "Roboto-Regular.ttf",
      );
      const fontBold = path.join(
        process.cwd(),
        "src",
        "assets",
        "fonts",
        "Roboto-Bold.ttf",
      );
      const defaultFont = fs.existsSync(fontRegular)
        ? fontRegular
        : "Helvetica";
      const boldFont = fs.existsSync(fontBold) ? fontBold : "Helvetica-Bold";

      // --- HEADER ---
      doc.rect(30, 30, 535, 60).fill("#1a1a1a");
      doc
        .font(boldFont)
        .fontSize(18)
        .fillColor("#ffffff")
        .text(t("pdf_marina_header", "ru"), 30, 45, {
          align: "center",
          width: 535,
        });
      doc
        .font(defaultFont)
        .fontSize(10)
        .fillColor("#cccccc")
        .text(t("system_coordinator_title", "ru"), 30, 70, {
          align: "center",
          width: 535,
        });

      doc.moveDown(3);
      let currentY = 110;

      // --- CUSTOMER INFO ---
      doc
        .fillColor("#000")
        .font(boldFont)
        .fontSize(12)
        .text(`${t("customer_label", "ru")}: `, 30, currentY, {
          continued: true,
        });
      doc.font(defaultFont).text(order.customerName);

      doc
        .font(boldFont)
        .text(`${t("order_label", "ru")}: `, 30, currentY + 15, {
          continued: true,
        });
      doc.font(defaultFont).text(order.orderNumber);

      doc
        .font(boldFont)
        .text(`${t("delivery_label", "ru")}: `, 30, currentY + 30, {
          continued: true,
        });
      doc.font(defaultFont).text(order.deliveryDate);

      currentY += 60;

      // --- TABLE HEADER ---
      const colX = [30, 150, 300, 430]; // Ürün, Detay, Departman, Personel
      doc.rect(30, currentY, 535, 20).fill("#f2f2f2").stroke("#ccc");
      doc.fillColor("#000").font(boldFont).fontSize(9);
      doc.text(t("pdf_table_product", "ru"), colX[0] + 5, currentY + 5);
      doc.text(t("pdf_table_details", "ru"), colX[1] + 5, currentY + 5);
      doc.text(t("dept_label", "ru"), colX[2] + 5, currentY + 5);
      doc.text(t("worker_label", "ru"), colX[3] + 5, currentY + 5);

      currentY += 20;

      // --- ROWS ---
      order.items.forEach((item, index) => {
        const rowHeight = 45;
        if (currentY + rowHeight > 750) {
          doc.addPage();
          currentY = 30;
          // Sub-header repeated on new page
          doc.rect(30, currentY, 535, 20).fill("#f2f2f2").stroke("#ccc");
          doc.fillColor("#000").font(boldFont).fontSize(9);
          doc.text(t("pdf_table_product", "ru"), colX[0] + 5, currentY + 5);
          doc.text(t("pdf_table_details", "ru"), colX[1] + 5, currentY + 5);
          doc.text(t("dept_label", "ru"), colX[2] + 5, currentY + 5);
          doc.text(t("worker_label", "ru"), colX[3] + 5, currentY + 5);
          currentY += 20;
        }

        doc.rect(30, currentY, 535, rowHeight).stroke("#eee");

        doc
          .font(boldFont)
          .fontSize(9)
          .text(`${index + 1}. ${item.product}`, colX[0] + 5, currentY + 10, {
            width: 110,
          });
        doc
          .font(defaultFont)
          .fontSize(8)
          .text(item.details || "-", colX[1] + 5, currentY + 5, { width: 140 });

        const ruDept = this.getDeptTranslation(item.department, "ru");
        doc.text(
          `${ruDept}\n(${item.department})`,
          colX[2] + 5,
          currentY + 10,
          { width: 120 },
        );

        const worker =
          item.assignedWorker || t("dist_not_assigned", "ru").toUpperCase();
        doc
          .font(boldFont)
          .fillColor(item.assignedWorker ? "#1a73e8" : "#d93025")
          .text(worker, colX[3] + 5, currentY + 15, { width: 100 });
        doc.fillColor("#000");

        currentY += rowHeight;
      });

      // --- FOOTER ---
      doc
        .fontSize(8)
        .fillColor("#999")
        .text(t("pdf_footer", "ru"), 30, 780, { align: "center", width: 535 });

      doc.end();
    });
  }

  /**
   * Marina için Kumaş Sipariş Raporu PDF'i oluşturur.
   */
  async generateFabricOrderPDF(order: OrderDetail): Promise<Buffer> {
    const fabricItems = order.items.filter(
      (i) =>
        i.fabricDetails ||
        (i.details && i.details.toLowerCase().includes("kumaş")),
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));

      const fontRegular = path.join(
        process.cwd(),
        "src",
        "assets",
        "fonts",
        "Roboto-Regular.ttf",
      );
      const fontBold = path.join(
        process.cwd(),
        "src",
        "assets",
        "fonts",
        "Roboto-Bold.ttf",
      );
      const defaultFont = fs.existsSync(fontRegular)
        ? fontRegular
        : "Helvetica";
      const boldFont = fs.existsSync(fontBold) ? fontBold : "Helvetica-Bold";

      // HEADER
      doc.rect(30, 30, 535, 50).fill("#5d4037"); // Brownish color for fabric
      doc
        .font(boldFont)
        .fontSize(16)
        .fillColor("#ffffff")
        .text("KUMAŞ SİPARİŞ RAPORU / ЗАКАЗ ТКАНИ", 30, 45, {
          align: "center",
          width: 535,
        });

      let currentY = 100;
      doc
        .fillColor("#000")
        .font(boldFont)
        .fontSize(11)
        .text(`${t("customer_label", "ru")}: `, 30, currentY, {
          continued: true,
        })
        .font(defaultFont)
        .text(order.customerName);

      doc
        .font(boldFont)
        .text(`Sipariş No / № Заказа: `, 30, currentY + 15, { continued: true })
        .font(defaultFont)
        .text(order.orderNumber);

      currentY += 50;

      fabricItems.forEach((item, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 40;
        }

        doc.rect(30, currentY, 535, 100).stroke("#ccc");

        // Image
        if (item.imageBuffer) {
          try {
            doc.image(item.imageBuffer, 40, currentY + 10, { fit: [80, 80] });
          } catch (e) {}
        }

        doc
          .fillColor("#000")
          .font(boldFont)
          .fontSize(10)
          .text(`${index + 1}. ${item.product}`, 130, currentY + 15);

        const fabric = item.fabricDetails;
        if (fabric) {
          doc
            .font(boldFont)
            .text(`Kumaş / Ткань: `, 130, currentY + 35, { continued: true })
            .font(defaultFont)
            .text(fabric.name || "-");
          doc
            .font(boldFont)
            .text(`Miktar / Кол-во: `, 130, currentY + 50, { continued: true })
            .font(defaultFont)
            .text(`${(fabric.amount * (item.quantity || 1)).toFixed(1)} m`);
        } else {
          doc
            .font(defaultFont)
            .text(item.details || "-", 130, currentY + 35, { width: 400 });
        }

        currentY += 110;
      });

      doc
        .fontSize(8)
        .fillColor("#999")
        .text(t("pdf_footer", "ru"), 30, 780, { align: "center", width: 535 });
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
   * Oluşturulan PDF iş emrini yerel klasöre arşivler. (Marina özeti dahil)
   */
  async archivePDF(deptName: string, pdfBuffer: Buffer): Promise<string> {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const pdfDir = path.join(process.cwd(), "data", "orders", today, "pdfs");

    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const safeName = deptName.replace(/[^a-z0-9]/gi, "_").toUpperCase();
    const fileName = `is_emri_${safeName}_${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    fs.writeFileSync(filePath, pdfBuffer);
    console.log(`📂 PDF arşivlendi: ${filePath}`);
    return filePath;
  }

  /**
   * Siparişi log dosyasına kaydeder.
   */
  private async logOrder(order: OrderDetail) {
    const timestamp = new Date().toLocaleString("tr-TR");
    let logEntry = `[${timestamp}] YENİ SİPARİŞ: ${order.orderNumber} - Müşteri: ${order.customerName}\n`;

    order.items.forEach((item) => {
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
    const orderIndex = this.orders.findIndex((o) => o.id === orderId);
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
  public generateDeptView(
    items: OrderItem[],
    customerName: string,
    dept: string,
  ): string {
    const today = new Date().toLocaleDateString("tr-TR");
    const now = new Date().toLocaleTimeString("tr-TR");

    const labelProduct = t("product_label", "ru");
    const labelQuantity = t("order_label", "ru"); // "Quantity" or "Order" can use order_label as proxy or similar
    const labelDetails = t("details_label", "ru");
    const labelCustomer = t("customer_label", "ru");
    const labelDate = t("pdf_date", "ru");

    const ruDeptTitle = this.getDeptTranslation(dept, "ru").toUpperCase();
    let view = `📑 *${ruDeptTitle} / ${dept.toUpperCase()}*\n`;
    view += `━━━━━━━━━━━━━━━━━━━━\n`;
    view += `👤 *${labelCustomer}:* ${OrderService.escapeMarkdown(customerName)}\n`;
    view += `📅 *${labelDate}:* ${today} | ${now}\n`;
    view += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    items.forEach((item, idx) => {
      view += `${idx + 1}. *${labelProduct}: ${OrderService.escapeMarkdown(item.product)}*\n`;
      view += `   🔢 ${labelQuantity}: ${item.quantity}\n`;
      view += `   📝 ${labelDetails}: ${OrderService.escapeMarkdown(item.details || "Нет / Yok")}\n`;
      view += `   📍 Kaynak: ${item.source === "Stock" ? "Stok / Склад" : item.source === "Production" ? "Üretim / Производство" : "Dış Alım / Закупка"}\n\n`;
    });

    view += `━━━━━━━━━━━━━━━━━━━━\n`;
    view += `⚠️ _${t("pdf_footer", "ru")}_`;

    return view;
  }

  /**
   * Ürün görsellerini yerel diske kaydeder ve vektörlerini Supabase'e (pgvector) yollar.
   */
  async saveToVisualMemory(order: OrderDetail) {
    // Görseller için yerel klasör (data/images/YYYY-MM-DD) oluştur
    const today = new Date().toISOString().split("T")[0];
    const imageDir = path.join(process.cwd(), "data", "images", today);

    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    for (const item of order.items) {
      if (item.imageBuffer) {
        try {
          console.log(`🧠 Görsel hafıza işleniyor: ${item.product}`);
          const extension = item.imageExtension || "jpg";

          // 1. Resmi Yerel Klasöre Kaydet
          const safeProductName = item.product
            .replace(/[^a-z0-9]/gi, "_")
            .toLowerCase();
          const fileName = `${order.id}_${item.id}_${safeProductName}_${Date.now()}.${extension}`;
          const filePath = path.join(imageDir, fileName);
          fs.writeFileSync(filePath, item.imageBuffer);

          // URL adresini /data/images formatında siparişe ekle
          item.imageUrl = `/data/images/${today}/${fileName}`;

          // Güncellenmiş siparişi hem lokalin hem Supabase'in görmesi için order güncellensin
          await this.supabase.upsertOrderItem(item, order.id);

          // 2. Vektörü Çıkar ve Supabase pgvector'a (visual_memory tablosuna) Gönder
          const vector =
            await this.imageEmbeddingService.generateImageEmbedding(
              item.imageBuffer,
              extension,
            );

          await this.supabase.upsertVisualMemory(
            `${order.id}_${item.id}_${Date.now()}`,
            item.product,
            order.customerName,
            order.id, // Pass the internal UUID/ID of the order, not the order number string
            [item.department, item.source],
            vector,
            item.imageUrl || "",
          );
          console.log(`✅ Görsel ve vektör kaydedildi: ${item.product}`);
        } catch (error) {
          console.error(
            `❌ Görsel hafıza ve yerel kayıt hatası (${item.product}):`,
            error,
          );
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
      // Windows'ta pathToFileURL kullanarak düzgün file:// URL oluştur
      const nodeModulesPath = path.join(
        process.cwd(),
        "node_modules",
        "pdfjs-dist",
      );
      const cMapUrl =
        pathToFileURL(path.join(nodeModulesPath, "cmaps")).href + "/";
      const standardFontDataUrl =
        pathToFileURL(path.join(nodeModulesPath, "standard_fonts")).href + "/";

      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        useSystemFonts: true, // Sistem fontlarını kullan (Rusça karakter desteği için)
        disableFontFace: false, // Font-face kullan (daha iyi render)
        cMapUrl: cMapUrl,
        cMapPacked: true,
        standardFontDataUrl: standardFontDataUrl,
        isEvalSupported: false, // Node.js kısıtlamaları için
      });

      const pdfDocument = await loadingTask.promise;

      // İlk sayfayı al
      const page = await pdfDocument.getPage(1);

      // Okunabilirlik için scale (3.0 yüksek kalite sağlar)
      const scale = 3.0;

      // Roboto fontlarını Canvas'a kaydet (Manual yedek olarak)
      const { registerFont } = require("canvas");
      const regularPath = path.join(
        process.cwd(),
        "src",
        "assets",
        "fonts",
        "Roboto-Regular.ttf",
      );
      const boldPath = path.join(
        process.cwd(),
        "src",
        "assets",
        "fonts",
        "Roboto-Bold.ttf",
      );

      if (fs.existsSync(regularPath))
        registerFont(regularPath, { family: "Roboto" });
      if (fs.existsSync(boldPath))
        registerFont(boldPath, { family: "Roboto", weight: "bold" });

      const viewport = page.getViewport({ scale });

      // Canvas oluştur
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      // Arkaplanı beyaz yap
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Render ayarları
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      console.log(
        "[OrderService] PDF başarıyla resme dönüştürüldü (Scale: 3.0).",
      );
      return canvas.toBuffer("image/png");
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
        item.status = "uretimde";
        item.distributedAt = new Date().toISOString();
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
  public async updateFabricStatus(
    orderId: string,
    itemId: string,
    arrived: boolean,
    note?: string,
  ): Promise<boolean> {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return false;

    const item = order.items.find((i) => i.id === itemId);
    if (!item) return false;

    if (!item.fabricDetails) {
      item.fabricDetails = { name: "Bilinmiyor", amount: 0, arrived: false };
    }

    item.fabricDetails.arrived = arrived;
    if (note) item.fabricDetails.issueNote = note;
    item.updatedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();

    if (arrived) {
      item.lastReminderAt = undefined; // Hatırlatmayı durdur
      item.status = "bekliyor";
    }

    // Supabase güncelle
    await this.supabase.upsertOrderItem(item, order.id);
    this.saveToLocalFile();
    return true;
  }

  public getOrders() {
    return this.orders;
  }

  public getOrderItemById(
    itemId: string,
  ): { order: OrderDetail; item: OrderItem } | null {
    for (const order of this.orders) {
      const item = order.items.find((i) => i.id === itemId);
      if (item) return { order, item };
    }
    return null;
  }

  public getActiveTrackingItems(): { order: OrderDetail; item: OrderItem }[] {
    const activeItems: { order: OrderDetail; item: OrderItem }[] = [];
    this.orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!["hazir", "sevk_edildi", "arsivlendi"].includes(item.status)) {
          activeItems.push({ order, item });
        }
      });
    });
    return activeItems;
  }

  /**
   * Takip gerektiren kalemleri döner.
   * "uretimde" statüsünde ve distributedAt'ten beri belirli gün geçmiş olanlar.
   * Ahşap/Metal/Dekorasyon → 20 gün, Dikişhane/Döşemehane → 15 gün
   */
  public getItemsNeedingFollowUp(
    daysAfter: number = 20,
  ): { order: OrderDetail; item: OrderItem }[] {
    const deptTimelines: Record<string, number> = {
      ahşap: 20,
      "metal üretimi": 20,
      "mobilya dekorasyon": 20,
      "karkas üretimi": 20,
      dikişhane: 15,
      döşemehane: 15,
    };
    const now = new Date();
    const results: { order: OrderDetail; item: OrderItem }[] = [];

    this.orders.forEach((order) => {
      order.items.forEach((item) => {
        if (
          item.status === "uretimde" &&
          item.distributedAt &&
          item.assignedWorker
        ) {
          // Departmana göre takip süresini belirle
          const deptKey = Object.keys(deptTimelines).find((d) =>
            item.department.toLowerCase().includes(d),
          );
          if (!deptKey) return;

          const requiredDays = deptTimelines[deptKey];
          const dist = new Date(item.distributedAt);
          const daysPassed = Math.floor(
            (now.getTime() - dist.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysPassed >= requiredDays) {
            results.push({ order, item });
          }
        }
      });
    });
    return results;
  }

  /**
   * Siparişteki diğer kalemlerden birinin "Boyahane" departmanında olup olmadığını kontrol eder.
   */
  public orderNeedsPaint(orderId: string): boolean {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return false;
    return order.items.some(
      (item) =>
        item.department.toLowerCase().includes("boya") &&
        item.status === "bekliyor",
    );
  }

  /**
   * Siparişin boya kalemlerini bulur.
   */
  public getPaintItemsForOrder(orderId: string): OrderItem[] {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return [];
    return order.items.filter(
      (item) =>
        item.department.toLowerCase().includes("boya") &&
        item.status === "bekliyor",
    );
  }

  public getOrderItemByShortId(
    shortId: string,
  ): { order: OrderDetail; item: OrderItem } | null {
    for (const order of this.orders) {
      const item = order.items.find((i) => i.id.startsWith(shortId));
      if (item) {
        return { order, item };
      }
    }
    return null;
  }

  /**
   * Departman için detaylı iş emri PDF'i oluşturur.
   * Görselleri ve ürün detaylarını içerir. Dil: RU
   */
  async generateJobOrderPDF(
    items: OrderItem[],
    customerName: string,
    department: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 30, size: "A4" });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err: Error) => reject(err));

        const fontRegular = path.join(
          process.cwd(),
          "src",
          "assets",
          "fonts",
          "Roboto-Regular.ttf",
        );
        const fontBold = path.join(
          process.cwd(),
          "src",
          "assets",
          "fonts",
          "Roboto-Bold.ttf",
        );
        const defaultFont = fs.existsSync(fontRegular)
          ? fontRegular
          : "Helvetica";
        const boldFont = fs.existsSync(fontBold) ? fontBold : "Helvetica-Bold";

        // --- HEADER ---
        doc.rect(30, 30, 535, 50).fill("#1a1a1a");
        const ruDept = this.getDeptTranslation(department, "ru");
        doc
          .font(boldFont)
          .fontSize(16)
          .fillColor("#ffffff")
          .text(
            `${ruDept.toUpperCase()} / ${department.toUpperCase()}`,
            30,
            45,
            {
              align: "center",
              width: 535,
            },
          );

        doc.moveDown(2);
        let currentY = 100;

        // --- CUSTOMER INFO ---
        doc
          .fillColor("#000")
          .font(boldFont)
          .fontSize(12)
          .text(`${t("customer_label", "ru")}: `, 30, currentY, {
            continued: true,
          });
        doc.font(defaultFont).text(customerName);

        doc.font(boldFont).text(`${t("pdf_date", "ru")}: `, 30, currentY + 15, {
          continued: true,
        });
        doc.font(defaultFont).text(new Date().toLocaleDateString("tr-TR"));

        currentY += 45;

        // --- ITEMS ---
        items.forEach((item, index) => {
          if (currentY > 600) {
            doc.addPage();
            currentY = 40;
          }

          // Item Box
          doc.rect(30, currentY, 535, 150).stroke("#cccccc");

          // Image if exists
          if (item.imageBuffer) {
            try {
              doc.image(item.imageBuffer, 40, currentY + 15, {
                fit: [120, 120],
                align: "center",
                valign: "center",
              });
            } catch (e) {
              doc
                .fontSize(8)
                .fillColor("#999")
                .text(t("pdf_no_image_error", "ru"), 40, currentY + 60);
            }
          } else {
            doc.rect(40, currentY + 15, 120, 120).stroke("#eee");
            doc
              .fontSize(8)
              .fillColor("#999")
              .text(t("pdf_no_image", "ru"), 65, currentY + 65);
          }

          // Details
          doc.fillColor("#000").font(boldFont).fontSize(11);
          doc.text(`${index + 1}. ${item.product}`, 180, currentY + 20);

          doc.font(boldFont).fontSize(10);
          doc.text(`${t("order_label", "ru")}:`, 180, currentY + 45, {
            continued: true,
          });
          doc.font(defaultFont).text(` ${item.quantity}`);

          doc
            .font(boldFont)
            .text(`${t("details_label", "ru")}:`, 180, currentY + 65);
          doc
            .font(defaultFont)
            .fontSize(9)
            .text(item.details || "-", 180, currentY + 80, { width: 360 });

          if (item.assignedWorker) {
            doc
              .font(boldFont)
              .text(`${t("worker_label", "ru")}:`, 180, currentY + 120, {
                continued: true,
              });
            doc.font(defaultFont).text(` ${item.assignedWorker}`);
          }

          currentY += 165;
        });

        // --- FOOTER ---
        doc.fontSize(7).fillColor("#aaa").text(t("pdf_footer", "ru"), 30, 790, {
          align: "center",
          width: 535,
        });

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * 24 saat geçmiş ve hala gelmemiş kumaşları bulur.
   */
  public getPendingFabricReminders(): {
    order: OrderDetail;
    item: OrderItem;
  }[] {
    const now = new Date();
    const reminders: { order: OrderDetail; item: OrderItem }[] = [];

    this.orders.forEach((order) => {
      order.items.forEach((item) => {
        const isFabricDept =
          item.department.toLowerCase().includes("dikiş") ||
          item.department.toLowerCase().includes("döşeme") ||
          item.department.toLowerCase() === "kumaş";

        if (isFabricDept && item.fabricDetails && !item.fabricDetails.arrived) {
          const lastReminder = item.lastReminderAt
            ? new Date(item.lastReminderAt)
            : new Date(item.distributedAt || item.createdAt);

          const hoursPassed =
            (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60);

          if (hoursPassed >= 24) {
            reminders.push({ order, item });
          }
        }
      });
    });

    return reminders;
  }

  /**
   * Hatırlatma zamanını günceller.
   */
  public updateLastReminder(orderId: string, itemId: string) {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return;
    const item = order.items.find((i) => i.id === itemId);
    if (!item) return;

    item.lastReminderAt = new Date().toISOString();
    this.saveToLocalFile();
  }
}
