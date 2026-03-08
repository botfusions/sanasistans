import { Context } from "grammy";
import { ProductionService } from "../utils/production.service";
import { CalendarService } from "../utils/calendar.service";
import { StaffService } from "../utils/staff.service";
import { OrderService } from "../utils/order.service";
import { t, getUserLanguage, Language } from "../utils/i18n";

export class CommandHandler {
  private productionService: ProductionService;
  private calendarService: CalendarService;
  private staffService: StaffService;
  private orderService: OrderService;

  constructor() {
    this.productionService = new ProductionService();
    this.calendarService = new CalendarService();
    this.staffService = StaffService.getInstance();
    this.orderService = new OrderService();
  }

  private isBoss(ctx: Context): boolean {
    return (ctx as any).role === "SuperAdmin" || (ctx as any).role === "boss";
  }

  private getLang(ctx: Context): Language {
    return getUserLanguage((ctx as any).role || "guest");
  }

  public async handleStart(ctx: Context) {
    const userId = ctx.from?.id;
    const staffMember = userId
      ? this.staffService.getStaffByTelegramId(userId)
      : null;
    const isBoss = this.isBoss(ctx);
    const lang = staffMember?.language || (isBoss ? "tr" : "ru");

    if (isBoss) {
      await ctx.reply(t("welcome_boss", lang as Language), {
        parse_mode: "Markdown",
      });
      return;
    }

    if (staffMember) {
      await ctx.reply(
        t("welcome_staff", lang as Language, {
          name: staffMember.name,
          department: staffMember.department,
        }),
        { parse_mode: "Markdown" },
      );
    } else {
      await ctx.reply(t("welcome_guest", "ru"), { parse_mode: "Markdown" });
    }
  }

  public async handleDurum(ctx: Context) {
    const pending = await this.productionService.getPending();

    if (pending.length === 0) {
      await ctx.reply(
        "✨ Şu an bekleyen bir malzeme talebi yok, her şey yolunda!",
      );
      return;
    }

    let report = `📦 *Güncel Üretim & Malzeme Durumu:*\n\n`;
    pending.forEach((item, index) => {
      report += `${index + 1}. *${item.name}* \n   ┗ Durum: ${item.status}\n   ┗ İsteyen: ${item.requestedBy}\n`;
    });

    await ctx.reply(report, { parse_mode: "Markdown" });
  }

  public async handleAjanda(ctx: Context) {
    if (!this.isBoss(ctx)) {
      await ctx.reply("🔒 Bu özellik sadece Barış Bey'in erişimine açıktır.");
      return;
    }
    const events = await this.calendarService.getTodayAgenda();

    if (events.length === 0) {
      await ctx.reply(
        "📅 Bugün için takviminizde planlanmış bir etkinlik bulunmuyor Barış Bey.",
      );
      return;
    }

    let report = `🗓️ *Bugünün Takvim Planı (sandaluci88):*\n\n`;
    events.forEach((event) => {
      const start = new Date(event.start).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      report += `⏰ *${start}* - ${event.summary}\n`;
      if (event.location) report += `📍 ${event.location}\n`;
      report += `---\n`;
    });

    await ctx.reply(report, { parse_mode: "Markdown" });
  }

  public async handleTestBriefing(ctx: Context) {
    if (!this.isBoss(ctx)) return;
    await ctx.reply(
      "🔔 *Test Brifingi Tetiklendi:* \n\nBrifing mesajlarını kontrol ediniz.",
    );
  }

  public async handleStaff(ctx: Context) {
    if (!this.isBoss(ctx)) {
      await ctx.reply("🔒 Ekip listesini sadece Cenk Bey görüntüleyebilir.");
      return;
    }
    const staff = this.staffService.getAllStaff();
    if (staff.length === 0) {
      await ctx.reply("Henüz kayıtlı personel bulunmuyor Barış Bey.");
      return;
    }

    let message = "👥 *Kayıtlı Personel Listesi:*\n\n";
    staff.forEach((s) => {
      message += `- *${s.name}* (${s.department}) - ID: \`${s.telegramId}\`\n`;
    });

    await ctx.reply(message, { parse_mode: "Markdown" });
  }

  public async handleRegister(ctx: Context) {
    if (!this.isBoss(ctx)) {
      await ctx.reply(
        "🔒 Personel kaydı sadece Barış Bey tarafından yapılabilir.",
      );
      return;
    }

    const text = ctx.message?.text?.split(" ").slice(1).join(" ");
    if (!text || !text.includes("|")) {
      await ctx.reply(
        "Lütfen yeni personeli şu formatta ekleyin: \n`/kayit İsim | Departman | TelegramID` \n\nÖrn: `/kayit Bekbergen | Karkas Üretimi | 12345678`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const parts = text.split("|").map((s) => s.trim());
    if (parts.length < 3) {
      await ctx.reply("Lütfen tüm bilgileri (İsim, Departman, ID) girin.");
      return;
    }

    const [name, dept, idStr] = parts;
    const targetUserId = parseInt(idStr);

    if (isNaN(targetUserId)) {
      await ctx.reply("Hata: Telegram ID bir sayı olmalıdır.");
      return;
    }

    const departments = this.staffService.getDepartments();
    if (!departments.includes(dept)) {
      await ctx.reply(
        `Geçersiz departman. Geçerli bölümler:\n${departments.join("\n")}`,
      );
      return;
    }

    await this.staffService.registerStaff(targetUserId, name, dept);
    await ctx.reply(`✅ *${name}* (${dept}) başarıyla sisteme kaydedildi.`, {
      parse_mode: "Markdown",
    });
  }

  public async handleRemoveStaff(ctx: Context) {
    if (!this.isBoss(ctx)) {
      await ctx.reply("🔒 Personel silme yetkisi sadece Cenk Bey'e aittir.");
      return;
    }

    const text = ctx.message?.text?.split(" ")[1];
    if (!text) {
      await ctx.reply(
        "Lütfen silinecek personelin Telegram ID'sini girin: `/sil 12345678`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const targetUserId = parseInt(text);
    if (isNaN(targetUserId)) {
      await ctx.reply("Hata: Telegram ID bir sayı olmalıdır.");
      return;
    }

    const success = await this.staffService.removeStaff(targetUserId);
    if (success) {
      await ctx.reply(
        `✅ \`${targetUserId}\` ID'li personel sistemden silindi.`,
      );
    } else {
      await ctx.reply("❌ Bu ID ile kayıtlı personel bulunamadı.");
    }
  }

  public async handleDev(ctx: Context) {
    if (!this.isBoss(ctx)) {
      await ctx.reply(
        "🔒 Geliştirici Modu sadece Barış Bey'in erişimine açıktır.",
      );
      return;
    }

    const query = ctx.message?.text?.split(" ").slice(1).join(" ");
    if (!query) {
      await ctx.reply(
        "🛠️ *Ayça Geliştirici Modu*\n\nLütfen bir geliştirme talebi girin.\n\nÖrn: `/dev Yeni bir personel rolü eklemek için hangi dosyaları değiştirmeliyim?`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await ctx.reply("🔍 *SanaSistans Mimarisi Analiz Ediliyor...*", {
      parse_mode: "Markdown",
    });

    // Developer logic will be handled here via LLM
    // For now, we will use a specialized prompt in LLM Service
    const { OpenRouterService } = require("../utils/llm.service");
    const llm = new OpenRouterService();

    const technicalPrompt = `Sen bir Yazılım Mimarı ve "Agent Weaver" (Agent Dokuyucu) uzmanısın. SanaSistans (Sanal Asistan) projesinin kod yapısına ve otonom agent geliştirme standartlarına hakimsin. 
    Proje Yapısı:
    - src/index.ts: Bot giriş noktası
    - src/handlers: Mesaj ve komut işleyiciler
    - src/utils: Servisler (Supabase, Order, Production, Staff vb.)
    - docs/: Soul ve diğer dokümanlar
    - data/: JSON veritabanı (staff.json vb.)

    Agent Geliştirme Standartları (agent-development.md):
    - Agentlar markdown dosyası olarak tanımlanır.
    - YAML frontmatter (name, description, model, color, tools) içermelidir.
    - Description alanı tetikleme (trigger) koşullarını ve <example> bloklarını içermelidir.
    - Sistem promptu (body) ikinci şahıs ("Sen...") dilinde yazılmalıdır.
    
    Kullanıcının (Barış Bey) teknik sorusunu, geliştirme talebini veya yeni agent yaratma/onarma isteğini yanıtla. Agent yaratırken tam markdown yapısını sağla. Kod örnekleri ver.`;

    const response = await llm.chat(query, technicalPrompt);
    await ctx.reply(
      response || "Üzgünüm, teknik analiz sırasında bir hata oluştu.",
      { parse_mode: "Markdown" },
    );
  }

  public async handleTakip(ctx: Context) {
    if (!this.isBoss(ctx)) {
      await ctx.reply(t("tracking_boss_only", this.getLang(ctx)));
      return;
    }

    const activeItems = this.orderService.getActiveTrackingItems();
    if (activeItems.length === 0) {
      await ctx.reply(t("tracking_empty", this.getLang(ctx)));
      return;
    }

    const lang = this.getLang(ctx);
    let message = t("tracking_title", lang) + "\n\n";
    const { InlineKeyboard } = require("grammy");
    const keyboard = new InlineKeyboard();

    for (const entry of activeItems) {
      const { order, item } = entry;
      const statusIcon =
        item.status === "uretimde"
          ? "⚙️"
          : item.status === "boyada"
            ? "🎨"
            : item.status === "dikiste"
              ? "🧵"
              : item.status === "dosemede"
                ? "🪑"
                : "⏳";
      const statusText = t(`status_${item.status}`, lang);

      message += `${statusIcon} *${order.customerName}* - ${item.product}\n`;
      message += `   ┗ ${statusText}\n\n`;

      if (item.status === "bekliyor") {
        keyboard.text(
          t("btn_start_production", lang),
          `set_status:${item.id}:uretimde`,
        );
      } else if (item.status === "uretimde") {
        keyboard.text(
          t("btn_send_to_paint", lang),
          `set_status:${item.id}:boyada`,
        );
        keyboard.text(
          t("btn_send_to_sewing", lang),
          `set_status:${item.id}:dikiste`,
        );
      } else if (item.status === "boyada") {
        keyboard.text(
          t("btn_send_to_sewing", lang),
          `set_status:${item.id}:dikiste`,
        );
        keyboard.text(
          t("btn_send_to_upholstery", lang),
          `set_status:${item.id}:dosemede`,
        );
      } else if (item.status === "dikiste") {
        keyboard.text(
          t("btn_send_to_upholstery", lang),
          `set_status:${item.id}:dosemede`,
        );
        keyboard.text(t("btn_ready", lang), `set_status:${item.id}:hazir`);
      } else if (item.status === "dosemede") {
        keyboard.text(t("btn_ready", lang), `set_status:${item.id}:hazir`);
      }
      keyboard.row();
    }

    message += t("tracking_actions_hint", lang);

    keyboard
      .text(t("btn_refresh", lang), "refresh_tracking_list")
      .row()
      .text(t("btn_archive", lang), "archive_completed_items");

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }
}
