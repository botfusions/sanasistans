import { Context } from "grammy";
import { ProductionService } from "../utils/production.service";
import { QdrantService } from "../utils/qdrant.service";
import { OpenRouterService } from "../utils/llm.service";
import { StaffService } from "../utils/staff.service";

export class MessageHandler {
  private productionService: ProductionService;
  private qdrantService: QdrantService;
  private llmService: OpenRouterService;
  private staffService: StaffService;

  constructor() {
    this.productionService = new ProductionService();
    this.qdrantService = new QdrantService();
    this.llmService = new OpenRouterService();
    this.staffService = new StaffService();
  }

  public async handle(ctx: Context) {
    if (!ctx.message || !ctx.message.text) return;

    const originalText = ctx.message.text;
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

    // Qdrant'tan bağlam sorgula (Opsiyonel/Geliştirilecek)
    let context = "";
    const isQdrantReady = await this.qdrantService.checkConnection();

    if (isQdrantReady) {
      // Şimdilik sadece bağlantı loguna ekliyoruz, ilerde embedding araması eklenebilir.
      context = "Sandaluci üretim veritabanı aktif.";
    }

    const response = await this.llmService.chat(text, context);

    // Response'un Cenk Bey'e mi yoksa personele mi gittiğini ayarla
    await ctx.reply(
      response ||
        (isBoss
          ? "Üzgünüm Cenk Bey, bir hata oluştu."
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

      const jsonStr = response.replace(/```json|```/g, "").trim();
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
}
