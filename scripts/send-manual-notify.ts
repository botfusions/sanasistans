import { Bot, InlineKeyboard } from "grammy";
import { OrderService } from "../src/utils/order.service";
import { DraftOrderService } from "../src/utils/draft-order.service";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * UID 12 siparişi için eksik kalan Telegram bildirimlerini manuel olarak gönderen betik.
 */
async function sendMissingNotifications() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const marinaId = process.env.TELEGRAM_CHAT_ID;
  const orderId = "1773304037740"; // UID 12'nin kaydedilen ID'si

  if (!token || !marinaId) {
    console.error("❌ Ayarlar eksik!");
    return;
  }

  const bot = new Bot(token);
  const orderService = new OrderService();
  const draftOrderService = DraftOrderService.getInstance();

  try {
    console.log(`🔍 Sipariş verisi çekiliyor: ${orderId}`);
    const supabase = (orderService as any).supabase.client; // Doğrudan client'a erişim (servis içinde private ama any ile erişiyoruz veya getInstance)

    // Order verisini al (Supabase'den)
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        items:order_items(*)
      `,
      )
      .eq("id", orderId)
      .single();

    if (error || !order) {
      console.error("❌ Sipariş bulunamadı:", error);
      return;
    }

    if (error || !order) {
      console.error("❌ Sipariş bulunamadı:", error);
      return;
    }

    console.log(`📦 Sipariş Hazır: ${order.customerName}`);

    // Görsel Rapor Oluştur
    const visualReport = orderService.generateVisualTable(order);

    // Departman Kontrolü
    const needsDikis = order.items.some(
      (i: any) => i.department === "Dikişhane",
    );
    const needsDoseme = order.items.some(
      (i: any) => i.department === "Döşemehane",
    );

    const draftId = `draft_manual_${Date.now()}`;
    draftOrderService.saveDraft(draftId, { order, images: [] });

    const keyboard = new InlineKeyboard();
    if (needsDikis)
      keyboard
        .text("🧵 Dikişçi Seç", `select_dept_staff:${draftId}|Dikişhane`)
        .row();
    if (needsDoseme)
      keyboard
        .text("🪑 Döşemeci Seç", `select_dept_staff:${draftId}|Döşemehane`)
        .row();
    keyboard.text("🚀 DAĞITIMI BAŞLAT", `auto_distribute:${draftId}`).row();
    keyboard.text("❌ İptal Et", `reject_order:${draftId}`);

    console.log("📡 Telegram'a gönderiliyor...");

    await bot.api.sendMessage(
      marinaId,
      `📝 *UID 12 Sipariş Raporu (Manuel)*\n\n${visualReport}\n\nLütfen dağıtım öncesi personel seçimi yapınız:`,
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      },
    );

    console.log("✅ Manuel bildirim başarıyla gönderildi!");
  } catch (err) {
    console.error("❌ Hata:", err);
  }
}

sendMissingNotifications();
