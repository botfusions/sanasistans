import cron from "node-cron";
import { Bot, Context } from "grammy";
import { ProductionService } from "./production.service";
import { CalendarService } from "./calendar.service";
import { StaffService } from "./staff.service";
import { OrderService } from "./order.service";

export class CronService {
  private productionService: ProductionService;
  private calendarService: CalendarService;
  private staffService: StaffService;
  private orderService: OrderService;
  private bot: Bot;
  private targetChatId: string | number;

  constructor(bot: Bot, chatId: string | number) {
    this.bot = bot;
    this.targetChatId = chatId;
    this.productionService = new ProductionService();
    this.calendarService = new CalendarService();
    this.staffService = new StaffService();
    this.orderService = new OrderService();
  }

  public init() {
    // Sabah Brifingi (Haftaiçi 08:30)
    cron.schedule("30 8 * * 1-5", () => {
      this.sendMorningBriefing();
    });

    // Akşam Brifingi (Haftaiçi 18:00)
    cron.schedule("0 18 * * 1-5", () => {
      this.sendEveningBriefing();
    });

    // Cenk Bey: Malzeme Takibi Hatırlatması (Her gün 10:00)
    cron.schedule("0 10 * * *", () => {
      this.checkPendingMaterials();
    });

    // --- PERSONEL KONTROL MESAJLARI ---

    // Sabah (09:00) - Hazırlık Check
    cron.schedule("0 9 * * 1-5", () => {
      this.sendStaffControlMessage("morning");
    });

    // Öğlen (13:30) - Durum ve Engel Check
    cron.schedule("30 13 * * 1-5", () => {
      this.sendStaffControlMessage("noon");
    });

    // Akşam (17:30) - Kapanış ve Standartlaştırma
    cron.schedule("30 17 * * 1-5", () => {
      this.sendStaffControlMessage("evening");
    });

    // KUMAŞ TAKİP: 24 Saati geçen kumaş onaylarını kontrol et (Her 4 saatte bir)
    cron.schedule("0 */4 * * *", () => {
      this.checkFabricStatus();
    });
  }

  async sendMorningBriefing() {
    const events = await this.calendarService.getTodayAgenda();
    let calendarSummary = "\n\n📅 *Bugünkü Ajandanız:*";

    if (events.length === 0) {
      calendarSummary += "\nBugün için bir program gözükmüyor.";
    } else {
      events.forEach((event) => {
        const start = new Date(event.start).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        calendarSummary += `\n⏰ ${start} - ${event.summary}`;
      });
    }

    const message = `☀️ *Günaydın Cenk Bey!*\n\nBugünün üretim planı ve personel yoklaması için Ayça hazır. \n\n📌 *Stratejik Odak:* Bugün "Hoshin Kanri" hedeflerimize uygun olarak üretim darboğazlarını ve israfları (Muda) minimize etmeye odaklanalım.${calendarSummary}`;
    await this.bot.api.sendMessage(this.targetChatId, message, {
      parse_mode: "Markdown",
    });
  }

  async sendEveningBriefing() {
    const message = `🌙 *İyi Akşamlar Cenk Bey!*\n\nBugünün üretim raporu hazırlandı. Personel ile akşam check-pointleri tamamlandı. Standartlaştırılmış süreçlerimiz sayesinde yarın daha hızlı olacağız. İyi dinlenmeler! ✨`;
    await this.bot.api.sendMessage(this.targetChatId, message, {
      parse_mode: "Markdown",
    });
  }

  async checkPendingMaterials() {
    const pending = await this.productionService.getPending();
    if (pending.length > 0) {
      let list = `⚠️ *Cenk Bey, Bekleyen Malzeme Talepleri:*\n\n`;
      pending.forEach((item, index) => {
        list += `${index + 1}. ${item.name} (${item.quantity || "N/A"}) - *${item.status}*\n`;
      });
      await this.bot.api.sendMessage(this.targetChatId, list, {
        parse_mode: "Markdown",
      });
    }
  }

  async sendStaffControlMessage(type: "morning" | "noon" | "evening") {
    const staff = this.staffService.getAllStaff();

    for (const member of staff) {
      if (!member.telegramId) continue;

      let message = "";
      switch (type) {
        case "morning":
          message = `☀️ *Günaydın ${member.name}!* \n\nBugün *${member.department}* bölümünde her şey hazır mı? İşini daha iyi yapabilmen için önünde bir engel veya eksik malzeme var mı?`;
          break;
        case "noon":
          message = `🕛 *Selam ${member.name}!* \n\nGünün yarısı bitti. Planın neresindeyiz? Seni engelleyen bir durum (İnsan, Makine, Malzeme, Metot) var mı?`;
          break;
        case "evening":
          message = `🌙 *İyi Akşamlar ${member.name}!* \n\nBugün bölümünde neler başardın? Karşılaştığın problemleri kalıcı olarak çözmek için bir standart geliştirebildin mi? Yarın için bir hazırlığın var mı?`;
          break;
      }

      try {
        await this.bot.api.sendMessage(member.telegramId, message, {
          parse_mode: "Markdown",
        });
      } catch (error) {
        console.error(
          `❌ Personel mesajı gönderilemedi (${member.name}):`,
          error,
        );
      }
    }
  }

  async checkFabricStatus() {
    const orders = this.orderService.getOrders();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const order of orders) {
      const fabricPendingItems = order.items.filter(item => 
        (item.department === "Dikişhane" || item.department === "Kumaş") && 
        item.status === "pending" &&
        new Date(item.updatedAt || item.createdAt).getTime() < twentyFourHoursAgo.getTime()
      );

      for (const item of fabricPendingItems) {
        // Almira'yı bul (Dikişhane sorumlusu)
        const dikişhaneStaff = this.staffService.getStaffByDepartment("Dikişhane");
        const almira = dikişhaneStaff.find(s => s.name.toLowerCase().includes("almira")) || dikişhaneStaff[0];

        const alertMsg = `⚠️ *KUMAŞ GECİKME UYARISI* (24 Saat Geçti)\n\nMüşteri: ${order.customerName}\nÜrün: ${item.product}\nKumaş: ${item.fabricDetails?.name || "Belirtilmedi"}\n\nBu siparişin kumaş durumu henüz teyit edilmedi!`;

        if (almira && almira.telegramId) {
          await this.bot.api.sendMessage(almira.telegramId, alertMsg + "\n\nLütfen Telegram butonları üzerinden durumu güncelleyin.", { parse_mode: "Markdown" });
        }

        // Marina'ya da bilgi ver (Sorumlu olarak)
        const marina = this.staffService.getMarina();
        if (marina && marina.telegramId) {
          await this.bot.api.sendMessage(marina.telegramId, alertMsg, { parse_mode: "Markdown" });
        }
      }
    }
  }

  // Manuel tetikleme (Test için)
  async runManualTest() {
    await this.sendMorningBriefing();
    await this.checkPendingMaterials();
    await this.checkFabricStatus();
    await this.sendStaffControlMessage("morning");
  }
}
