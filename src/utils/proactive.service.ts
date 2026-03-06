import { Bot } from "grammy";
import { DoctorService } from "./doctor.service";
import { OrderService } from "./order.service";
import { StaffService } from "./staff.service";
import pino from "pino";

const logger = pino({ name: "ProactiveService", level: "info" });

export class ProactiveService {
  private doctorService: DoctorService;
  private orderService: OrderService;
  private staffService: StaffService;
  private bot: Bot;
  private supervisorId: number;

  constructor(bot: Bot, supervisorId: number) {
    this.bot = bot;
    this.supervisorId = supervisorId;
    this.doctorService = new DoctorService();
    this.orderService = new OrderService();
    this.staffService = StaffService.getInstance();
  }

  /**
   * Her saat başı çalışan "Heartbeat" (Kalp Atışı) kontrolü.
   * Kazakistan saat dilimine göre 06:00 - 20:00 arası tetiklenir.
   */
  public async runHeartbeat() {
    logger.info("💓 Proaktif kontrol başlatılıyor...");

    try {
      // 1. Teknik Sağlık Taraması
      const healthResults = await this.doctorService.runFullDiagnostics();
      const criticalErrors = healthResults.filter(r => r.status === "ERROR");

      // 2. Operasyonel Kontrol (Görev Takibi)
      const activeItems = this.orderService.getActiveTrackingItems();
      const pendingItems = activeItems.filter(entry => 
        (entry.item.status as any === "bekliyor" || entry.item.status as any === "yeni") && !entry.item.assignedWorker
      );

      // Departman bazlı özet (Boss için daha anlamlı)
      const deptCounts: Record<string, number> = {};
      activeItems.forEach(entry => {
        const dept = entry.item.department || "Diğer";
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      });

      // 3. Raporlama Kararı
      let shouldReport = false;
      let reportContent = "📑 *Süpervizör Teknik & Operasyonel Durum Raporu*\n\n";

      // Teknik Hatalar (Her zaman raporlanırsa shouldReport = true)
      if (criticalErrors.length > 0) {
        shouldReport = true;
        reportContent += "🚨 *Kritik Teknik Sorunlar (Acil Müdahale):*\n";
        criticalErrors.forEach(err => {
          reportContent += `• ${err.service}: ${err.message}\n  👉 _${err.remedy}_\n`;
        });
        reportContent += "\n";
      }

      // Aktif Görev Özeti (İş yükü varsa raporla)
      if (activeItems.length > 0) {
        // Eğer bekleyen iş sayısı 3'ten fazlaysa veya kritik bir durum varsa raporu gönder
        if (pendingItems.length >= 3 || criticalErrors.length > 0) {
          shouldReport = true;
        }

        reportContent += `📊 *Genel Görev Durumu:*\n`;
        reportContent += `• Toplam Aktif Görev: *${activeItems.length}*\n`;
        reportContent += `• Atama Bekleyen: *${pendingItems.length}*\n\n`;

        if (pendingItems.length > 0) {
          reportContent += `⚠️ *Bekleyen İş Yükü:* Şu an personel ataması bekleyen görevler var. Üretim akışı için personel seçimi yapılması önerilir.\n\n`;
        }

        reportContent += `🏢 *Departman Bazlı Dağılım:*\n`;
        Object.entries(deptCounts).forEach(([dept, count]) => {
          reportContent += `• ${dept}: ${count} görev\n`;
        });
      }

      // 4. Eğer her şey yolundaysa veya küçük sorunlar varsa sessiz kal (Spam önleme)
      if (shouldReport) {
        await this.bot.api.sendMessage(this.supervisorId, reportContent, { parse_mode: "Markdown" });
        logger.info("📩 Süpervizöre proaktif rapor gönderildi.");
      } else {
        logger.info("✅ Sistem stabil ve iş yükü normal (Aktif Görev: %d), sessiz kalınıyor.", activeItems.length);
      }

    } catch (error: any) {
      logger.error({ err: error }, "❌ Heartbeat çalışırken hata oluştu");
    }
  }
}
