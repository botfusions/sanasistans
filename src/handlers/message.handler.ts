import { Context } from "grammy";
import { ProductionService } from "../utils/production.service";
import { QdrantService } from "../utils/qdrant.service";
import { OpenRouterService } from "../utils/llm.service";
import { StaffService } from "../utils/staff.service";
import { OrderService } from "../utils/order.service";
import { VoiceService } from "../utils/voice.service";

export class MessageHandler {
  private productionService: ProductionService;
  private qdrantService: QdrantService;
  private llmService: OpenRouterService;
  private staffService: StaffService;
  private orderService: OrderService;
  private voiceService: VoiceService;

  constructor() {
    this.productionService = new ProductionService();
    this.qdrantService = new QdrantService();
    this.llmService = new OpenRouterService();
    this.staffService = StaffService.getInstance();
    this.orderService = new OrderService();
    this.voiceService = new VoiceService();
  }

  public async handle(ctx: Context) {
    if (!ctx.message) return;

    let originalText = "";

    if (ctx.message.text) {
      originalText = ctx.message.text;
    } else if (ctx.message.voice) {
      await ctx.reply("🎙️ Sesli mesajınızı dinliyorum, lütfen bekleyin...");
      const voiceLang = (ctx as any).role === "boss" ? "tr" : "ru";
      const transcribedText = await this.voiceService.transcribeVoiceMessage(ctx, ctx.message.voice.file_id, voiceLang);
      
      if (!transcribedText) {
        await ctx.reply("❌ Sesli mesajınızı çözümleyemedim veya OpenAI API anahtarı ayarlanmamış.");
        return;
      }
      
      await ctx.reply(`_"${transcribedText}"_`, { parse_mode: "Markdown" });
      originalText = transcribedText;
    } else {
      // Desteklenmeyen bir mesaj tipi, text veya voice değil
      return;
    }

    const text = originalText.toLowerCase();
    const role = (ctx as any).role;
    const staffInfo = (ctx as any).staffInfo;
    const isBoss = role === "boss";

    // Gönderici ismini belirle
    const senderName = isBoss
      ? "Cenk Bey"
      : staffInfo?.name || ctx.from?.first_name || "Bilinmeyen";

    // Malzeme Talebi Tespiti (Geliştirilmiş Regex/Keyword)
    const productionKeywords = [
      "lazım",
      "bitti",
      "eksik",
      "sipariş ver",
      "almamız lazım",
    ];
    const isProductionRequest = productionKeywords.some((kw) =>
      text.includes(kw),
    );

    if (isProductionRequest) {
      await this.handleProductionRequest(ctx, text, isBoss);
      return;
    }

    // Genel Mesaj İşleme (LLM + RAG simülasyonu)
    await this.handleGeneralMessage(ctx, originalText, isBoss);
  }

  private async handleProductionRequest(
    ctx: Context,
    text: string,
    isBoss: boolean,
  ) {
    // Basit bir ekstraksiyon (İleride LLM ile geliştirilebilir)
    const material = text
      .replace(/lazım|bitti|eksik|sipariş ver|almamız lazım/g, "")
      .trim();

    if (material) {
      const item = await this.productionService.add({
        name: material,
        requestedBy: ctx.from?.first_name || "Bilinmeyen",
        notes: `Otomatik algılama: ${ctx.message?.text}`,
      });

      // Departman tespiti (basit eşleştirme)
      let mentionText = "";
      if (text.includes("karkas") || text.includes("iskelet")) {
        const staff = this.staffService.getStaffByDepartment("Karkas Üretimi");
        if (staff.length > 0)
          mentionText = `\n\n🔔 @${staff[0].name} ilgilenebilir mi?`;
      } else if (text.includes("kumaş") || text.includes("dikiş")) {
        const staff = this.staffService.getStaffByDepartment("Dikişhane");
        if (staff.length > 0)
          mentionText = `\n\n🔔 @${staff[0].name} stok kontrolü yapabilir mi?`;
      }

      await ctx.reply(
        `✅ *Kayıt Edildi:* "${item.name}" malzeme listesine eklendi. \n\nDurum: *Talep Edildi*${mentionText}`,
        { parse_mode: "Markdown" },
      );
    } else {
      const greeting = isBoss
        ? "Cenk Bey"
        : ctx.from?.first_name || "Ekip Arkadaşım";

      await ctx.reply(
        `Ne lazım olduğunu tam anlayamadım ${greeting}, tekrar söyler misiniz?`,
      );
    }
  }

  private async handleGeneralMessage(
    ctx: Context,
    text: string,
    isBoss: boolean,
  ) {
    // E-posta Gönderme Tespiti
    const emailKeywords = ["mail at", "mail gönder", "e-posta at", "e-posta gönder"];
    const isEmailRequest = emailKeywords.some((kw) => text.includes(kw));

    if (isEmailRequest) {
      await this.handleEmailRequest(ctx, text, isBoss);
      return;
    }

    // Hatırlatıcı / Zamanlı Görev Tespiti
    const reminderKeywords = ["hatırlat", "zamanında", "alarm kur", "haber ver", "sonra bildir"];
    const isReminderRequest = reminderKeywords.some((kw) => text.includes(kw));

    if (isReminderRequest) {
      await this.handleReminderRequest(ctx, text, isBoss);
      return;
    }

    // Sipariş Durum Sorgulama Tespiti
    const statusKeywords = ["durum", "ne durumda", "hangi aşamada", "rapor", "bilgi ver"];
    const isStatusQuery = (text.includes("sipariş") || text.includes("muşteri") || text.includes("müşteri")) && statusKeywords.some((kw) => text.includes(kw));

    if (isStatusQuery && isBoss) {
      await this.handleOrderStatusQuery(ctx, text, isBoss);
      return;
    }

    // Qdrant'tan bağlam sorgula (Opsiyonel/Geliştirilecek)
    let context = "";
    const isQdrantReady = await this.qdrantService.checkConnection();

    if (isQdrantReady) {
      // Şimdilik sadece bağlantı loguna ekliyoruz, ilerde embedding araması eklenebilir.
      context = "Sandaluci üretim veritabanı aktif.";
    }

    const response = await this.llmService.chat(text, context);

    // Response'un Barış Bey'e bildirildi. yoksa personele mi gittiğini ayarla
    await ctx.reply(
      response ||
        (isBoss
          ? "Üzgünüm Barış Bey, bir hata oluştu."
          : "Üzgünüm, bir hata oluştu."),
    );
  }

  private async handleEmailRequest(ctx: Context, text: string, isBoss: boolean) {
    await ctx.reply("📧 E-posta gönderim talebinizi inceliyorum...");

    // LLM'den e-posta detaylarını JSON olarak çekelim
    const prompt = `
      Kullanıcı senden bir e-posta göndermeni istiyor. Aşağıdaki metinden alıcı e-posta adresini (kime gidecek), konuyu ve mail içeriğini çıkar.
      
      Kullanıcı Metni: "${text}"

      Lütfen YALNIZCA aşağıdaki JSON formatında yanıt ver, başka hiçbir açıklama ekleme:
      {
        "to": "alici@ornek.com",
        "subject": "E-posta Konusu",
        "body": "E-posta içeriği..."
      }
      
      Eğer metinde alıcı e-posta adresi yazmıyorsa "to" alanını boş ("") bırak.
    `;

    try {
      const response = await this.llmService.chat(prompt, "Email Parse Mode");
      if (!response) throw new Error("LLM Error");

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON not found in response");
      const jsonStr = jsonMatch[0].trim();
      const parsed = JSON.parse(jsonStr);

      if (!parsed.to) {
        await ctx.reply("❌ Kime e-posta atacağımı mesajınızda bulamadım. Lütfen e-posta adresini belirterek tekrar yazar mısınız?");
        return;
      }

      const { GmailService } = await import("../utils/gmail.service");
      const gmailService = GmailService.getInstance();
      
      const success = await gmailService.sendEmail(parsed.to, parsed.subject || "Sandaluci Bilgilendirme", parsed.body || "");

      if (success) {
        await ctx.reply(`✅ E-posta başarıyla gönderildi!\n\n**Alıcı:** ${parsed.to}\n**Konu:** ${parsed.subject}`);
      } else {
        await ctx.reply("❌ E-posta gönderilirken teknik bir hata oluştu.");
      }
    } catch (e) {
      console.error("Email parsing error:", e);
      await ctx.reply("❌ E-posta bilgilerinizi tam anlayamadım, lütfen daha açık yazar mısınız?");
    }
  }

  private async handleReminderRequest(ctx: Context, text: string, isBoss: boolean) {
    await ctx.reply("⏰ Hatırlatma talebinizi ayarlıyorum...");

    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      timeZone: "Asia/Almaty", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" 
    };
    const currentTime = now.toLocaleString("tr-TR", options);

    const prompt = `
      Kullanıcı senden bir hatırlatma ayarlamanı istiyor. Aşağıdaki metinden hatırlatılacak mesajı ve zamanını (cron formatında) çıkar.
      Zaman çıkarımı yaparken şunlara dikkat et:
      - Kazakistan/Almatı saati (UTC+5) kullanıyoruz. Şu anki zaman: ${currentTime}
      - Cron formatı sırasıyla şunlardır: Dakika(0-59) Saat(0-23) Gün(1-31) Ay(1-12) HaftanınGünü(0-7)
      - Örnek: "10 dakika sonra" -> şu anki dakikaya 10 ekle ve mod 60 al. Saati gerekirse artır.
      - Örnek: "Yarın sabah 9'da" -> "0 9 <yarınki_gun> <yarınki_ay> *"
      - Örnek: "Cenk bey'e karkasları sor" -> mesaj bu olacak.

      Lütfen YALNIZCA aşağıdaki JSON formatında yanıt ver, başka hiçbir açıklama ekleme:
      {
        "message": "Hatırlatılacak mesajın kendisi",
        "cron": "0 10 * * *"
      }
      
      Kullanıcı Metni: "${text}"
    `;

    try {
      const response = await this.llmService.chat(prompt, "Reminder Parse Mode");
      if (!response) throw new Error("LLM Error");

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON not found in response");
      const jsonStr = jsonMatch[0].trim();
      const parsed = JSON.parse(jsonStr);

      if (!parsed.message || !parsed.cron) {
        throw new Error("Missing fields in JSON");
      }

      const { CronService } = await import("../utils/cron.service");
      const cronService = CronService.getInstance();
      
      const task = cronService.addDynamicTask(
        ctx.chat?.id || "",
        parsed.message,
        parsed.cron,
        false
      );

      await ctx.reply(`✅ Hatırlatma kuruldu!\n\n**Mesaj:** ${task.message}\n**Zaman (Cron):** ${task.triggerTimeStr}`);
      
    } catch (e) {
      console.error("Reminder parsing error:", e);
      await ctx.reply("❌ Hatırlatma zamanını veya detayını tam anlayamadım, lütfen daha açık yazar mısınız (Örn: '5 dakika sonra Cenk Beye mesaj at' veya 'Yarın sabah 10 da toplantı var de').");
    }
  }

  private async handleOrderStatusQuery(ctx: Context, text: string, isBoss: boolean) {
    if (!isBoss) {
      await ctx.reply("❌ Sipariş raporlarını sorgulama yetkisi sadece yöneticilere aittir.");
      return;
    }

    await ctx.reply("📊 Sipariş durumunu veritabanından kontrol edip raporluyorum, lütfen bekleyin...");

    // Siparişleri çek
    const orders = this.orderService.getOrders();
    if (!orders || orders.length === 0) {
      await ctx.reply("Şu anda sistemde kayıtlı hiçbir sipariş bulunmuyor.");
      return;
    }

    // LLM'e veritabanındaki veriyi verip, kullanıcının ne sorduğunu ve doğru raporu üretmesini isteyelim (RAG yaklaşımı).
    // Basit bir JSON formatında sipariş ve durumları verelim.
    const ordersData = orders.map((o: any) => ({
      Musteri: o.customerName,
      Teslim_Tarihi: o.deliveryDate,
      Durum: o.items.map((i: any) => ({
        Urun: i.product,
        Miktar: i.quantity,
        Departman: i.department,
        Isi_Yapan: i.assignedWorker || "Atanmadı",
        Kumas_Geldimi: i.fabricDetails ? (i.fabricDetails.arrived ? "Geldi" : "Bekleniyor") : "N/A"
      }))
    }));

    const prompt = `
      Yönetici aşağıdaki soruyu sordu: "${text}"
      
      Şu an Veritabanında (Sistemde) kayıtlı olan tüm güncel sipariş bilgileri (JSON) şunlar:
      ${JSON.stringify(ordersData, null, 2)}
      
      Yöneticinin bu sorusuna yukarıdaki verilere TıpaTıp ve eksiksiz uyarak, güzel, net ve profesyonel bir şirket asistanı (Ayça) gibi Rapor hazırla.
      Eğer sorulan sipariş veya müşteri verilerde yoksa "Böyle bir sipariş kayıtlarımda bulunamadı" de.
      Yorum veya gereksiz masal katma, sadece elindeki veriye sadık kal.
    `;

    try {
      const response = await this.llmService.chat(prompt);
      await ctx.reply(response || "❌ Durum raporu oluşturulamadı.");
    } catch (e) {
      console.error("Order Status Report Error:", e);
      await ctx.reply("❌ Veritabanı okunurken bir hata oluştu.");
    }
  }
}
