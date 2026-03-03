import { Context } from "grammy";
import { ProductionService } from "../utils/production.service";
import { CalendarService } from "../utils/calendar.service";
import { StaffService } from "../utils/staff.service";

export class CommandHandler {
  private productionService: ProductionService;
  private calendarService: CalendarService;
  private staffService: StaffService;

  constructor() {
    this.productionService = new ProductionService();
    this.calendarService = new CalendarService();
    this.staffService = new StaffService();
  }

  private isBoss(ctx: Context): boolean {
    return (ctx as any).role === "boss";
  }

  public async handleStart(ctx: Context) {
    const userId = ctx.from?.id;
    const staffMember = userId
      ? this.staffService.getStaffByTelegramId(userId)
      : null;
    const isBoss = this.isBoss(ctx);

    if (isBoss) {
      await ctx.reply(
        `Hoş geldiniz Cenk Bey! 👋\n\nSandaluci üretim süreçleri ve ekip yönetimi için hazırım.\n\nKullanabileceğiniz Yönetici Komutları:\n/ajanda - Günlük planınız\n/personel - Ekip listesi\n/durum - Üretim durumu\n/kayit - Yeni personel ekle\n/sil - Personel sil`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (staffMember) {
      await ctx.reply(
        `Merhaba ${staffMember.name}! Ben Ayça. 👋\n\n*${staffMember.department}* bölümündeki süreçlerde sana destek olmak için buradayım.\n\nKullanabileceğin komutlar:\n/durum - Üretim durumu\n/start - Yardım menüsü`,
        { parse_mode: "Markdown" },
      );
    } else {
      await ctx.reply(
        `Merhaba! Ben Ayça, Sandaluci Yönetici Asistanıyım. 🙋‍♀️\n\nŞu an sadece kayıtlı personele hizmet verebiliyorum. Lütfen Cenk Bey ile iletişime geçerek kaydınızı yaptırın.`,
        { parse_mode: "Markdown" },
      );
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
      await ctx.reply("🔒 Bu özellik sadece Cenk Bey'in erişimine açıktır.");
      return;
    }
    const events = await this.calendarService.getTodayAgenda();

    if (events.length === 0) {
      await ctx.reply(
        "📅 Bugün için takviminizde planlanmış bir etkinlik bulunmuyor Cenk Bey.",
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
      await ctx.reply("Henüz kayıtlı personel bulunmuyor Cenk Bey.");
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
        "🔒 Personel kaydı sadece Cenk Bey tarafından yapılabilir.",
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
}
