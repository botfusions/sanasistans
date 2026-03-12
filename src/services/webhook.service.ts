import { Bot } from "grammy";
import { logger } from "../utils/logger";

export class WebhookService {
  private bot: Bot;
  private appUrl: string;

  constructor(bot: Bot) {
    this.bot = bot;
    this.appUrl = process.env.APP_URL || "";
  }

  /**
   * Telegram Webhook'unu kaydeder.
   * @param secretToken Güvenlik için kullanılacak gizli token
   */
  async registerWebhook(secretToken: string): Promise<boolean> {
    if (!this.appUrl) {
      logger.error("APP_URL eksik! Webhook kaydı yapılamaz.");
      return false;
    }

    const webhookUrl = `${this.appUrl}/api/telegram-webhook`;

    try {
      logger.info(`Webhook kaydediliyor: ${webhookUrl}`);

      await this.bot.api.setWebhook(webhookUrl, {
        secret_token: secretToken,
        drop_pending_updates: true,
        allowed_updates: ["message", "callback_query", "edited_message"],
      });

      logger.info("✅ Telegram Webhook başarıyla kaydedildi.");
      return true;
    } catch (error) {
      logger.error({ err: error }, "❌ Webhook kaydı sırasında hata oluştu");
      return false;
    }
  }

  /**
   * Webhook durumunu kontrol eder.
   */
  async getWebhookInfo() {
    try {
      return await this.bot.api.getWebhookInfo();
    } catch (error) {
      logger.error({ err: error }, "Webhook bilgisi alınamadı");
      return null;
    }
  }

  /**
   * Webhook'u siler (Polling moduna dönmek için).
   */
  async deleteWebhook(): Promise<boolean> {
    try {
      await this.bot.api.deleteWebhook();
      logger.info("🗑️ Webhook silindi, polling'e dönülebilir.");
      return true;
    } catch (error) {
      logger.error({ err: error }, "Webhook silinemedi");
      return false;
    }
  }

  /**
   * Dış sistemlerden (Dashboard) gelen olayları yönetir.
   */
  async handleExternalEvent(payload: {
    type: string;
    targetChatId?: string;
    message: string;
    secret?: string;
  }): Promise<boolean> {
    const { type, targetChatId, message, secret } = payload;

    // Basit bir güvenlik kontrolü
    const expectedSecret =
      process.env.WEBHOOK_SECRET || "sandaluci_secret_2024";
    if (secret !== expectedSecret) {
      logger.warn(`⚠️ Geçersiz webhook secret denemesi: ${type}`);
      return false;
    }

    try {
      const destination = targetChatId || process.env.TELEGRAM_CHAT_ID;
      if (!destination) {
        logger.error("Hedef Chat ID bulunamadı.");
        return false;
      }

      logger.info(`Dashboard Olayı İşleniyor: ${type}`);
      await this.bot.api.sendMessage(
        destination,
        `🖥 *Dashboard Bildirimi*\n\n${message}`,
        {
          parse_mode: "Markdown",
        },
      );

      return true;
    } catch (error) {
      logger.error({ err: error }, "Dış olay işlenirken hata oluştu");
      return false;
    }
  }
}
