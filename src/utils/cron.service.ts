import cron from "node-cron";
import { Bot, Context } from "grammy";
import { ProductionService } from "./production.service";
import { CalendarService } from "./calendar.service";
import { StaffService } from "./staff.service";
import { OrderService } from "./order.service";
import { KenanService } from "./kenan.service";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export interface DynamicTask {
  id: string;
  chatId: string | number;
  message: string;
  triggerTimeStr: string; // Example: "30 15 4 3 *"
  isRecurring: boolean;
}

export class CronService {
  private static instance: CronService;

  private productionService: ProductionService;
  private calendarService: CalendarService;
  private staffService: StaffService;
  private orderService: OrderService;
  private kenanService: KenanService;
  private bot: Bot;
  private targetChatId: string | number;
  
  private tasksFile = path.resolve("./data/tasks.json");
  private activeDynamicJobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor(bot: Bot, chatId: string | number) {
    this.bot = bot;
    this.targetChatId = chatId;
    this.productionService = new ProductionService();
    this.calendarService = new CalendarService();
    this.staffService = new StaffService();
    this.orderService = new OrderService();
    this.kenanService = new KenanService();
    
    // Klasör yoksa oluştur
    const dir = path.dirname(this.tasksFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public static getInstance(bot?: Bot, chatId?: string | number): CronService {
    if (!CronService.instance) {
      if (!bot || !chatId) {
        throw new Error("CronService requires bot and chatId for initialization");
      }
      CronService.instance = new CronService(bot, chatId);
    }
    return CronService.instance;
  }

  public init() {
    // Mevcut sabit görevler
    this.initStaticJobs();
    
    // Dinamik görevleri yükle ve başlat
    this.loadAndScheduleDynamicTasks();
  }

  private initStaticJobs() {
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
    cron.schedule("0 9 * * 1-5", () => {
      this.sendStaffControlMessage("morning");
    });
    cron.schedule("30 13 * * 1-5", () => {
      this.sendStaffControlMessage("noon");
    });
    cron.schedule("30 17 * * 1-5", () => {
      this.sendStaffControlMessage("evening");
    });

    // KUMAŞ TAKİP: 24 Saati geçen kumaş onaylarını kontrol et (Her 4 saatte bir)
    cron.schedule("0 */4 * * *", () => {
      this.checkFabricStatus();
    });
  }

  // --- DINAMIK GÖREV YÖNETIMİ ---

  private getStoredTasks(): DynamicTask[] {
    if (!fs.existsSync(this.tasksFile)) {
      return [];
    }
    try {
      const data = fs.readFileSync(this.tasksFile, "utf-8");
      return JSON.parse(data) as DynamicTask[];
    } catch (error) {
      console.error("❌ tasks.json okunamadı:", error);
      return [];
    }
  }

  private saveTasks(tasks: DynamicTask[]) {
    try {
      fs.writeFileSync(this.tasksFile, JSON.stringify(tasks, null, 2), "utf-8");
    } catch (error) {
      console.error("❌ tasks.json yazılamadı:", error);
    }
  }

  public addDynamicTask(chatId: string | number, message: string, triggerTimeStr: string, isRecurring: boolean = false): DynamicTask {
    const newTask: DynamicTask = {
      id: uuidv4(),
      chatId,
      message,
      triggerTimeStr,
      isRecurring
    };

    const tasks = this.getStoredTasks();
    tasks.push(newTask);
    this.saveTasks(tasks);

    this.scheduleJob(newTask);
    return newTask;
  }

  private loadAndScheduleDynamicTasks() {
    const tasks = this.getStoredTasks();
    tasks.forEach(task => this.scheduleJob(task));
    console.log(`✅ ${tasks.length} adet dinamik görev yüklendi.`);
  }

  private scheduleJob(task: DynamicTask) {
    if (!cron.validate(task.triggerTimeStr)) {
      console.error(`❌ Geçersiz cron verisi: ${task.triggerTimeStr} for task ${task.id}`);
      this.removeTask(task.id);
      return;
    }

    const job = cron.schedule(task.triggerTimeStr, async () => {
      try {
        await this.bot.api.sendMessage(task.chatId, `⏰ *Hatırlatma:* \n\n${task.message}`, {
          parse_mode: "Markdown",
        });
      } catch (err) {
        console.error(`❌ Hatırlatma gönderilemedi (Chat: ${task.chatId}):`, err);
      }

      // Tek seferlikse dosyadan sil ve durdur
      if (!task.isRecurring) {
        job.stop();
        this.activeDynamicJobs.delete(task.id);
        this.removeTask(task.id);
      }
    });

    this.activeDynamicJobs.set(task.id, job);
  }

  public removeTask(taskId: string) {
    let tasks = this.getStoredTasks();
    tasks = tasks.filter(t => t.id !== taskId);
    this.saveTasks(tasks);

    const job = this.activeDynamicJobs.get(taskId);
    if (job) {
      job.stop();
      this.activeDynamicJobs.delete(taskId);
    }
  }

  // --- MEVCUT YARDIMCI FONKSIYONLAR ---

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
          // EĞER KENAN AKTİFSE: Özel sabah mesajı oluştur
          if (process.env.ENABLE_KENAN === "true") {
            message = await this.kenanService.generateCoachingMessage(member, "Sabah ve güne başlama motivasyonu");
          } else {
            message = `☀️ *Günaydın ${member.name}!* \n\nBugün *${member.department}* bölümünde her şey hazır mı? İşini daha iyi yapabilmen için önünde bir engel veya eksik malzeme var mı?`;
          }
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
        console.error(`❌ Personel mesajı gönderilemedi (${member.name}):`, error);
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
        const dikişhaneStaff = this.staffService.getStaffByDepartment("Dikişhane");
        const almira = dikişhaneStaff.find(s => s.name.toLowerCase().includes("almira")) || dikişhaneStaff[0];
        const alertMsg = `⚠️ *KUMAŞ GECİKME UYARISI* (24 Saat Geçti)\n\nMüşteri: ${order.customerName}\nÜrün: ${item.product}\nKumaş: ${item.fabricDetails?.name || "Belirtilmedi"}\n\nBu siparişin kumaş durumu henüz teyit edilmedi!`;
        if (almira && almira.telegramId) {
          await this.bot.api.sendMessage(almira.telegramId, alertMsg + "\n\nLütfen Telegram butonları üzerinden durumu güncelleyin.", { parse_mode: "Markdown" });
        }
        const marina = this.staffService.getMarina();
        if (marina && marina.telegramId) {
          await this.bot.api.sendMessage(marina.telegramId, alertMsg, { parse_mode: "Markdown" });
        }
      }
    }
  }

  async runManualTest() {
    await this.sendMorningBriefing();
    await this.checkPendingMaterials();
    await this.checkFabricStatus();
    await this.sendStaffControlMessage("morning");
  }
}

