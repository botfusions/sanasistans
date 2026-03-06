import { Bot, InlineKeyboard, InputFile } from "grammy";
import * as fs from "fs";
import * as path from "path";
import http from "http";
import * as dotenv from "dotenv";
import { MessageHandler } from "./handlers/message.handler";
import { CommandHandler } from "./handlers/command.handler";
import { CronService } from "./utils/cron.service";
import { GmailService } from "./utils/gmail.service";
import { OrderService } from "./utils/order.service";
import { StaffService } from "./utils/staff.service";
import { XlsxUtils } from "./utils/xlsx-utils";
import { pino } from "pino";
import { DraftOrderService } from "./utils/draft-order.service";
import { t, getUserLanguage } from "./utils/i18n";
import { DoctorService } from "./utils/doctor.service";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});

// Çevresel değişkenleri yükle
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const allowlist = (process.env.TELEGRAM_ALLOWLIST_USER_ID || "")
  .split(",")
  .map((id) => id.trim());

if (!token) {
  console.error(
    "❌ TELEGRAM_BOT_TOKEN bulunamadı! Lütfen .env dosyasını kontrol edin.",
  );
  process.exit(1);
}

// Bot ve Handler'ları başlatalım
const bot = new Bot(token);
const staffService = StaffService.getInstance();
const draftOrderService = DraftOrderService.getInstance();
const orderService = new OrderService();
const messageHandler = new MessageHandler();
const commandHandler = new CommandHandler();
const doctorService = new DoctorService();

const marinaId = (allowlist[0] && allowlist[0] !== "") ? allowlist[0] : (chatId || "");
console.log(`👤 Onay Yetkilisi (Marina): ${marinaId}`);

// Güvenlik & Rol Yönetimi Katmanı
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const staffMember = staffService.getStaffByTelegramId(userId);
  const isBoss = allowlist.includes(userId.toString()) || staffMember?.role === "SuperAdmin";
  const isRegisteredStaff = !!staffMember;

  // Context'e rol bilgisini ekleyelim (Opsiyonel: grammy context extension da yapılabilir ama şimdilik basitleştirelim)
  (ctx as any).role = isBoss ? "boss" : isRegisteredStaff ? "staff" : "guest";
  (ctx as any).staffInfo = staffMember;

  const isRegisterCommand = ctx.message?.text?.startsWith("/kayit");
  const isStartCommand = ctx.message?.text?.startsWith("/start");

  if (isBoss || isRegisteredStaff || isRegisterCommand || isStartCommand) {
    return next();
  }

  // Yetkisiz erişim denemesi
  if (ctx.chat?.type === "private") {
    await ctx.reply(
      "Merhaba! Ben Ayça. 🙋‍♀️ Şu an sadece Barış Bey ve kayıtlı Sandaluci personeline hizmet veriyorum.\n\nEğer ekipten biriysen lütfen `/kayit İsim | Departman` komutuyla kendini tanıtır mısın?",
      { parse_mode: "Markdown" },
    );
  }
});

// Komutlar
bot.command("start", (ctx) => commandHandler.handleStart(ctx));
bot.command("durum", (ctx) => commandHandler.handleDurum(ctx));
bot.command("ajanda", (ctx) => commandHandler.handleAjanda(ctx));
bot.command("personel", (ctx) => commandHandler.handleStaff(ctx));
bot.command("kayit", (ctx) => commandHandler.handleRegister(ctx));
bot.command("sil", (ctx) => commandHandler.handleRemoveStaff(ctx));
bot.command("dev", (ctx) => commandHandler.handleDev(ctx));
bot.command("test_briefing", (ctx) => commandHandler.handleTestBriefing(ctx));
bot.command("takip", (ctx) => commandHandler.handleTakip(ctx));
bot.command("doctor", async (ctx) => {
  if ((ctx as any).role !== "boss") {
    return ctx.reply("❌ Bu komut sadece Barış Bey (SuperAdmin) için yetkilendirilmiştir.");
  }
  const statusMsg = await ctx.reply("🩺 *Sistem damarları kontrol ediliyor...* Lütfen bekleyin.", { parse_mode: "Markdown" });
  try {
    const results = await doctorService.runFullDiagnostics();
    const report = doctorService.formatReport(results);
    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, report, { parse_mode: "Markdown" });
  } catch (error: any) {
    logger.error({ error }, "Doctor command error");
    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Kritik hata: ${error.message}`);
  }
});

// Normal Mesajlar
bot.on("message", (ctx) => messageHandler.handle(ctx));

// Callback Query İşleyici (Buton Tıklamaları)
bot.on("callback_query:data", async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const [action, itemId] = data.split(":");

    if (action === "refresh_tracking_list") {
      const lang = getUserLanguage((ctx as any).role || "guest");
      const activeItems = orderService.getActiveTrackingItems();
      if (activeItems.length === 0) {
        await ctx.editMessageText(t("tracking_empty", lang));
        return;
      }

      let message = t("tracking_title", lang) + "\n\n";
      const keyboard = new InlineKeyboard();

      for (const entry of activeItems) {
        const { order, item } = entry;
        const statusIcon = item.status === "uretimde" ? "⚙️" : 
                           item.status === "boyada" ? "🎨" :
                           item.status === "dikiste" ? "🧵" :
                           item.status === "dosemede" ? "🪑" : "⏳";
        const statusText = t(`status_${item.status}`, lang);
        
        message += `${statusIcon} *${order.customerName}* - ${item.product}\n`;
        message += `   ┗ ${statusText}\n\n`;

        if (item.status === "bekliyor") keyboard.text(t("btn_start_production", lang), `set_status:${item.id}:uretimde`);
        else if (item.status === "uretimde") { keyboard.text(t("btn_send_to_paint", lang), `set_status:${item.id}:boyada`); keyboard.text(t("btn_send_to_sewing", lang), `set_status:${item.id}:dikiste`); }
        else if (item.status === "boyada") { keyboard.text(t("btn_send_to_sewing", lang), `set_status:${item.id}:dikiste`); keyboard.text(t("btn_send_to_upholstery", lang), `set_status:${item.id}:dosemede`); }
        else if (item.status === "dikiste") { keyboard.text(t("btn_send_to_upholstery", lang), `set_status:${item.id}:dosemede`); keyboard.text(t("btn_ready", lang), `set_status:${item.id}:hazir`); }
        else if (item.status === "dosemede") keyboard.text(t("btn_ready", lang), `set_status:${item.id}:hazir`);
        keyboard.row();
      }

      message += t("tracking_actions_hint", lang);
      keyboard.text(t("btn_refresh", lang), "refresh_tracking_list").row()
        .text(t("btn_archive", lang), "archive_completed_items");

      await ctx.editMessageText(message, { parse_mode: "Markdown", reply_markup: keyboard });
      await ctx.answerCallbackQuery(t("tracking_refreshed", lang));

    } else if (action === "set_status") {
      const lang = getUserLanguage((ctx as any).role || "guest");
      const [id, newStatus] = itemId.split(":");
      await orderService.updateItemStatus(id, newStatus as any);
      
      const activeItems = orderService.getActiveTrackingItems();
      let message = t("tracking_title", lang) + "\n\n";
      const keyboard = new InlineKeyboard();
      for (const entry of activeItems) {
        const { order, item } = entry;
        const statusIcon = item.status === "uretimde" ? "⚙️" : 
                           item.status === "boyada" ? "🎨" :
                           item.status === "dikiste" ? "🧵" :
                           item.status === "dosemede" ? "🪑" : "⏳";
        const statusText = t(`status_${item.status}`, lang);
        message += `${statusIcon} *${order.customerName}* - ${item.product}\n`;
        message += `   ┗ ${statusText}\n\n`;
        if (item.status === "bekliyor") keyboard.text(t("btn_start_production", lang), `set_status:${item.id}:uretimde`);
        else if (item.status === "uretimde") { keyboard.text(t("btn_send_to_paint", lang), `set_status:${item.id}:boyada`); keyboard.text(t("btn_send_to_sewing", lang), `set_status:${item.id}:dikiste`); }
        else if (item.status === "boyada") { keyboard.text(t("btn_send_to_sewing", lang), `set_status:${item.id}:dikiste`); keyboard.text(t("btn_send_to_upholstery", lang), `set_status:${item.id}:dosemede`); }
        else if (item.status === "dikiste") { keyboard.text(t("btn_send_to_upholstery", lang), `set_status:${item.id}:dosemede`); keyboard.text(t("btn_ready", lang), `set_status:${item.id}:hazir`); }
        else if (item.status === "dosemede") keyboard.text(t("btn_ready", lang), `set_status:${item.id}:hazir`);
        keyboard.row();
      }
      message += t("tracking_actions_hint", lang);
      keyboard.text(t("btn_refresh", lang), "refresh_tracking_list").row().text(t("btn_archive", lang), "archive_completed_items");

      await ctx.editMessageText(message, { parse_mode: "Markdown", reply_markup: keyboard });
      await ctx.answerCallbackQuery(t("notification_status_updated", lang, { status: newStatus }));

    } else if (action === "production_done") {
      // Personel "Evet, bitti" dedi → statüyü güncelle + boya kontrolü
      const itemData = orderService.getOrderItemById(itemId);
      if (!itemData) {
        await ctx.answerCallbackQuery("❌ Sipariş bulunamadı.");
        return;
      }
      const { order, item } = itemData;
      const workerStaff = item.assignedWorker ? staffService.getStaffByName(item.assignedWorker) : null;
      const workerLang = workerStaff?.language || "ru";

      // Statüyü hazır yap
      await orderService.updateItemStatus(item.id, "hazir");
      await ctx.editMessageText(t("followup_noted_done", workerLang as any), { parse_mode: "Markdown" });

      // Boya kontrolü: siparişte boya kalemi var mı?
      if (orderService.orderNeedsPaint(order.id)) {
        const paintItems = orderService.getPaintItemsForOrder(order.id);
        for (const paintItem of paintItems) {
          // Boya bölümü personelini bul
          const paintStaff = staffService.getStaffByDepartment("Boyahane");
          if (paintStaff.length > 0 && paintStaff[0].telegramId) {
            const paintLang = paintStaff[0].language || "ru";
            const paintMsg = t("notification_new_order", paintLang as any, {
              customer: order.customerName,
              product: paintItem.product,
              quantity: String(paintItem.quantity),
              department: "Boyahane"
            });
            await bot.api.sendMessage(paintStaff[0].telegramId, paintMsg, { parse_mode: "Markdown" });
            await orderService.updateItemStatus(paintItem.id, "boyada");
            paintItem.distributedAt = new Date().toISOString();
          }
        }
        // Marina'ya boya bildirimi
        const marina = staffService.getMarina();
        if (marina && marina.telegramId) {
          await bot.api.sendMessage(marina.telegramId, t("followup_paint_sent", marina.language || "ru" as any), { parse_mode: "Markdown" });
        }
      }

    } else if (action === "production_ongoing") {
      // Personel "Hayır, devam ediyor" dedi → 3 gün sonra tekrar sor
      const itemData = orderService.getOrderItemById(itemId);
      if (!itemData) {
        await ctx.answerCallbackQuery("❌ Sipariş bulunamadı.");
        return;
      }
      const { item } = itemData;
      const workerStaff = item.assignedWorker ? staffService.getStaffByName(item.assignedWorker) : null;
      const workerLang = workerStaff?.language || "ru";

      // lastReminderAt güncelle (3 gün sonra cron tekrar soracak)
      item.lastReminderAt = new Date().toISOString();
      item.updatedAt = new Date().toISOString();
      
      await ctx.editMessageText(t("followup_noted_ongoing", workerLang as any), { parse_mode: "Markdown" });

    } else if (action === "assign_worker") {
      const [targetItemId, workerName] = itemId.split(":");
      const itemData = orderService.getOrderItemById(targetItemId);
      if (!itemData) {
        await ctx.answerCallbackQuery("❌ Ürün bulunamadı.");
        return;
      }
      const { order, item } = itemData;
      const staff = staffService.getStaffByName(workerName);
      
      if (!staff || !staff.telegramId) {
        await ctx.answerCallbackQuery("❌ Personel bulunamadı veya ID'si yok.");
        return;
      }

      // Ürünü personele ata
      await orderService.assignWorkerToItem(item.id, staff.name);

      // Personele iş emri gönder
      const pdfBuffer = await orderService.generateJobOrderPDF([item], order.customerName, item.department);
      const pdfViewBuffer = await orderService.generatePDFView(pdfBuffer);
      
      await bot.api.sendPhoto(staff.telegramId, new InputFile(pdfViewBuffer), {
        caption: `🧵 *YENİ İŞ EMRİ*\n\n👤 *Müşteri:* ${order.customerName}\n📦 *Ürün:* ${item.product}\n🔢 *Miktar:* ${item.quantity}\n📝 *Detay:* ${item.details || "Yok"}`,
        parse_mode: "Markdown"
      });

      await ctx.editMessageCaption({ caption: `✅ *GÖREVLENDİRME TAMAMLANDI*\n\n👤 *Personel:* ${staff.name}\n📦 *Ürün:* ${item.product}\n\n_İş emri iletildi._`, parse_mode: "Markdown" });
      await ctx.answerCallbackQuery(`İş ${staff.name} personeline iletildi.`);

      // Eğer siparişteki TÜM kalemler atanmışsa, Marina'ya final raporu gönder
      const allAssigned = order.items.every((i: any) => !!i.assignedWorker);
      if (allAssigned) {
        const finalReport = orderService.generateVisualTable(order);
        await bot.api.sendMessage(marinaId, `🏁 *TÜM DAĞITIM TAMAMLANDI*\n\n${finalReport}`, { parse_mode: "Markdown" });
      }
    } else if (action === "select_dept_staff") {
      const [draftId, dept] = itemId.split("|");
      const deptStaff = staffService.getStaffByDepartment(dept);
      
      if (deptStaff.length === 0) {
        await ctx.answerCallbackQuery(`❌ ${dept} için kayıtlı personel bulunamadı.`);
        return;
      }

      const keyboard = new InlineKeyboard();
      deptStaff.forEach((s, idx) => {
        keyboard.text(s.name, `assign_dept_staff:${draftId}|${dept}|${s.telegramId}`);
        if ((idx + 1) % 2 === 0) keyboard.row();
      });
      keyboard.row().text("⬅️ Geri", `refresh_draft:${draftId}`);

      await ctx.editMessageText(`👤 *${dept}* birimi için personel seçiniz:`, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });

    } else if (action === "assign_dept_staff") {
      const [draftId, dept, staffIdStr] = itemId.split("|");
      const staffId = parseInt(staffIdStr);
      const staff = staffService.getStaffByTelegramId(staffId);
      
      draftOrderService.updateAssignment(draftId, dept, staffId);
      await ctx.answerCallbackQuery(`✅ ${dept}: ${staff?.name || 'Seçildi'}`);

      // Ana taslak mesajına geri dön
      await handleDraftMessageUpdate(ctx, draftId);

    } else if (action === "refresh_draft") {
      await handleDraftMessageUpdate(ctx, itemId);

    } else if (action === "auto_distribute") {
      const draftId = itemId;
      const draft = draftOrderService.getDraft(draftId);
      if (!draft) return;

      await ctx.answerCallbackQuery("🚀 Dağıtım başlatılıyor...");
      await ctx.editMessageText("✅ *Dağıtım Başlatıldı*\nİş emirleri ilgili birimlere iletiliyor...", { parse_mode: "Markdown" });
      
      // Tüm birimleri (Karkas, Metal, Dikiş, Döşeme vb.) dağıt ve en son Marina'ya özet rapor gönder
      await processOrderDistribution(draft.order, draft.images, draft.excelRows, draft.assignments, undefined, true);
      draftOrderService.removeDraft(draftId);

    } else if (action === "reject_order") {
      const draftId = itemId;
      draftOrderService.removeDraft(draftId);
      await ctx.answerCallbackQuery("❌ Sipariş iptal edildi.");
      await ctx.editMessageText("❌ *Sipariş İptal Edildi*", { parse_mode: "Markdown" });
    }
  } catch (err) {
    logger.error({ err }, "Callback query error");
    await ctx.answerCallbackQuery("❌ Bir hata oluştu.");
  }
});

/**
 * Taslak mesajını güncel (atama durumlarıyla birlikte) gösterir
 */
async function handleDraftMessageUpdate(ctx: any, draftId: string) {
  const draft = draftOrderService.getDraft(draftId);
  if (!draft) {
    await ctx.editMessageText("❌ Taslak bulunamadı.");
    return;
  }

  const visualReport = orderService.generateVisualTable(draft.order);
  const dikisWorker = staffService.getStaffByTelegramId(draft.assignments["Dikişhane"])?.name || "🔘 Seçilmedi";
  const dosemeWorker = staffService.getStaffByTelegramId(draft.assignments["Döşemehane"])?.name || "🔘 Seçilmedi";

  const keyboard = new InlineKeyboard()
    .text(`🧵 Dikiş: ${dikisWorker}`, `select_dept_staff:${draftId}|Dikişhane`).row()
    .text(`🪑 Döşeme: ${dosemeWorker}`, `select_dept_staff:${draftId}|Döşemehane`).row();

  // Akıllı Dağıtım Kontrolü: Siparişte Dikiş veya Döşeme varsa seçilmeden "Dağıtımı Başlat" butonunu gösterme
  // Marina'nın atama yapması gereken tüm departmanları kontrol et
  const deptsRequiringManualAssignment = ["Dikişhane", "Döşemehane"];
  const orderItems = draft.order.items || [];
  
  // Siparişte olan ve manuel atama bekleyen departmanları bul
  const activeManualDepts = deptsRequiringManualAssignment.filter(dept => 
    orderItems.some((item: any) => item.department === dept)
  );

  // Hepsinin atandığını doğrula
  const isEverythingAssigned = activeManualDepts.every(dept => 
    draft.assignments && draft.assignments[dept]
  );

  const isDistributionReady = isEverythingAssigned;

  if (isDistributionReady) {
    keyboard.text("🚀 DAĞITIMI BAŞLAT", `auto_distribute:${draftId}`).row();
  }

  keyboard.text("❌ İptal Et", `reject_order:${draftId}`);

  await ctx.editMessageText(`📝 *Sipariş Detayları*\n\n${visualReport}\n\n*Lütfen yukarıdan gerekli birimleri (🧵 Dikiş / 🪑 Döşeme) atayınız. Atama bittikten sonra "DAĞITIMI BAŞLAT" butonu otomatik belirecektir.*`, {
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
}

// --- YARDIMCI FONKSİYONLAR (GLOBAL SCOPE) ---

/**
 * Sipariş Dağıtımını Yönetir
 */
async function processOrderDistribution(order: any, emailImages: any[], excelRows?: any[], manualAssignments?: Record<string, number>, deptFilter?: string[], sendSummary: boolean = true) {
  const marinaId = allowlist[0];
  let departments = Array.from(new Set(order.items.map((i: any) => i.department))) as string[];

  // Filtre varsa uygula
  if (deptFilter) {
    departments = departments.filter(d => deptFilter.includes(d));
  }

  for (const dept of departments) {
    const deptItems = order.items.filter((i: any) => i.department === dept);
    const currentDept = dept as string;

    // Excel resimlerini personelle eşleştir
    if (excelRows) {
      deptItems.forEach((item: any) => {
        const row = excelRows.find(r => r._rowNumber === item.rowIndex);
        if (row && row._imageBuffer) {
          item.imageBuffer = row._imageBuffer;
          item.imageExtension = row._imageExtension;
        }
      });
    }

    const deptMsg = orderService.generateDeptView(deptItems, order.customerName as string, currentDept);

    try {
      // PDF oluştur ve Arşivle
      const pdfBuffer = await orderService.generateJobOrderPDF(deptItems, order.customerName || "Belirtilmedi", currentDept);
      await orderService.archivePDF(currentDept, pdfBuffer);
      const pdfViewBuffer = await orderService.generatePDFView(pdfBuffer);

      let targetIds: number[] = [];
      
      // Manuel atama varsa öncelikli kullan
      if (manualAssignments && manualAssignments[currentDept]) {
        targetIds = [manualAssignments[currentDept]];
      } else {
        const staffMembers = staffService.getStaffByDepartment(currentDept);
        targetIds = staffMembers.length > 0 ? staffMembers.map(s => s.telegramId).filter(id => !!id) as number[] : [parseInt(marinaId)];
      }

      const productImages = deptItems.filter((i: any) => i.imageBuffer).map((item: any, idx: number) => ({
        type: "photo" as const,
        media: new InputFile(item.imageBuffer, `p_${idx}.${item.imageExtension || 'jpg'}`)
      }));

      // --- INTERAKTIF BUTONLAR VE ÖZEL BİLDİRİMLER ---
      for (const targetId of targetIds) {
        if (!targetId) continue;

        // 1. DÖŞEMEHANE / DİKİŞHANE ÖZEL: Sadece manuel atama YAPILMAMIŞSA Marina'ya işçi seçme butonları gönder
        const isManualAssignmentDone = manualAssignments && manualAssignments[currentDept];
        if ((currentDept === "Döşemehane" || currentDept === "Dikişhane") && !isManualAssignmentDone) {
          // Eğer bu aşamada hala atama yoksa, Marina'ya detaylı bir seçim kartı gönder
          for (const item of deptItems) {
            const deptStaff = staffService.getStaffByDepartment(currentDept);
            const keyboard = new InlineKeyboard();
            
            deptStaff.forEach((staff, index) => {
              keyboard.text(staff.name, `assign_worker:${item.id}:${staff.name}`);
              if ((index + 1) % 2 === 0) keyboard.row();
            });

            const detailsText = item.details ? `\n📝 *Detay:* ${item.details}` : "";

            await bot.api.sendPhoto(marinaId, productImages[0]?.media || new InputFile(pdfViewBuffer), {
              caption: `🧶 *${currentDept} Görevlendirme*\n\n👤 *Müşteri:* ${order.customerName}\n📦 *Ürün:* ${item.product}\n🔢 *Miktar:* ${item.quantity}${detailsText}\n\n*İşi kime verelim?*`,
              parse_mode: "Markdown",
              reply_markup: keyboard
            });
          }
          continue;
        }

        // 2. KUMAŞ (Almira): Kumaş onay butonları
        if (currentDept === "Kumaş") {
          for (const item of deptItems) {
            const totalFabric = item.fabricDetails?.amount ? (item.fabricDetails.amount * item.quantity).toFixed(1) : "?";
            const fabricInfo = item.fabricDetails ? `\n\n📌 *Kumaş:* ${item.fabricDetails.name}\n📏 *Toplam İhtiyaç:* ${totalFabric} metre` : "";
            
            const keyboard = new InlineKeyboard()
              .text("✅ Kumaş Geldi", `fabric_ok:${item.id}`)
              .text("❌ Kumaş Yok/Eksik", `fabric_fail:${item.id}`);

            await bot.api.sendPhoto(targetId, productImages[0]?.media || new InputFile(pdfViewBuffer), {
              caption: `🧶 *Kumaş Hazırlık Emri*\n\nMüşteri: ${order.customerName}\nÜrün: ${item.product}\nMiktar: ${item.quantity}${fabricInfo}\n\nLütfen kumaş durumunu teyit edin:`,
              parse_mode: "Markdown",
              reply_markup: keyboard
            });
          }
          continue;
        }

        // 3. DİĞER DEPARTMANLAR
        const media: any[] = [
          {
            type: "photo" as const,
            media: new InputFile(pdfViewBuffer, `job_order.png`),
            caption: deptMsg,
            parse_mode: "Markdown" as const
          },
          ...productImages
        ];

        if (media.length > 1) {
          await bot.api.sendMediaGroup(targetId, media);
        } else {
          await bot.api.sendPhoto(targetId, media[0].media, {
            caption: media[0].caption,
            parse_mode: "Markdown"
          });
        }

        // Takip için: Otomatik birimlerde assignedWorker ve distributedAt damgala
        const targetStaff = staffService.getStaffByTelegramId(targetId);
        if (targetStaff) {
          for (const dItem of deptItems) {
            if (!dItem.assignedWorker) {
              dItem.assignedWorker = targetStaff.name;
              dItem.distributedAt = new Date().toISOString();
              dItem.status = "uretimde";
              dItem.updatedAt = new Date().toISOString();
            }
          }
        }
      }
    } catch (distError) {
      logger.error({ err: distError, dept: currentDept }, "Dağıtım hatası");
    }
  }

  if (sendSummary) {
    const finalVisualReport = orderService.generateVisualTable(order);
    try {
      await bot.api.sendMessage(marinaId, `🔔 *SAYIN MARİNA HANIM*\n\nSipariş dağıtım işlemleri tamamlandı.\n\n${finalVisualReport}`, { parse_mode: "Markdown" });
      logger.info("✅ Marina Hanıma final raporu gönderildi.");
    } catch (e) {
      logger.error({ err: e }, "❌ Dağıtım akışı hatası.");
    }
  }

  // Marina hanıma özet tabloyu SADECE her şey tamamsa at (Yarım kalmışsa manual atama bittiğinde gidecek)
  const isEverythingDistributed = order.items.every((i: any) => !!i.assignedWorker);
  if (isEverythingDistributed) {
    try {
      const finalSummary = orderService.generateVisualTable(order);
      await bot.api.sendMessage(marinaId, finalSummary, { parse_mode: "Markdown" });
    } catch (e) {
      logger.error({ err: e }, "❌ Marina raporu gönderilemedi.");
    }
  }
}

// Cron Servisi (Eğer chatId verilmişse başlat)
if (chatId) {
  const cronService = CronService.getInstance(bot, chatId);
  cronService.init();
  console.log("📅 Cron Servisi Aktif Edildi.");

  // Gmail Servisi ve Periyodik Kontrol (Her 1 dakikada bir - Kilit Mekanizmalı)
  const gmailService = GmailService.getInstance();
 // E-posta mükerrer işlemeyi önlemek için UID takibi (Kalıcı depolama)
const UID_STORE_PATH = path.join(process.cwd(), "data", "processed_uids.json");
let processedUids: Set<string> = new Set<string>();

function loadProcessedUids() {
  try {
    if (fs.existsSync(UID_STORE_PATH)) {
      const data = fs.readFileSync(UID_STORE_PATH, "utf-8");
      processedUids = new Set(JSON.parse(data));
      logger.info(`✅ ${processedUids.size} adet işlenmiş UID yüklendi.`);
    }
  } catch (error) {
    logger.error({ error }, "❌ processed_uids.json yüklenemedi");
  }
}

function saveProcessedUids() {
  try {
    const data = JSON.stringify(Array.from(processedUids));
    if (!fs.existsSync(path.dirname(UID_STORE_PATH))) {
      fs.mkdirSync(path.dirname(UID_STORE_PATH), { recursive: true });
    }
    fs.writeFileSync(UID_STORE_PATH, data);
  } catch (error) {
    logger.error({ error }, "❌ processed_uids.json kaydedilemedi");
  }
}

loadProcessedUids();

  let isProcessingEmail = false;

  setInterval(
    async () => {
      if (isProcessingEmail) {
        logger.warn("⏳ Önceki e-posta işleme henüz bitmedi, döngü atlanıyor.");
        return;
      }
      isProcessingEmail = true;

      try {
        await gmailService.processUnreadMessages(1, async (msg: { uid: string | number; from: string; subject: string; attachments?: any[]; content?: string }) => {
          // Zaten işlenmiş UID'yi atla
      // İşlenen e-postayı kaydet
      if (processedUids.has(msg.uid.toString())) {
            logger.info(`🔄 UID ${msg.uid} zaten işlendi, atlanıyor.`);
            return;
          }

          // Gereksiz sistem/bildirim maillerini filtrele
          const skipDomains = ["groq.co", "supabase.com", "github.com", "google.com", "newsletter"];
          if (skipDomains.some(domain => msg.from.toLowerCase().includes(domain))) {
            logger.info(`🧹 Sistem maili atlanıyor: ${msg.subject} (${msg.from})`);
            processedUids.add(msg.uid.toString()); // Ensure UID is string
            return;
          }

          logger.info(`📩 Yeni e-posta işleniyor: ${msg.subject} (UID: ${msg.uid})`);
          // E-posta bildirimi
          const emailSummary = `📧 *Yeni E-posta* \n\n*Gönderen:* ${msg.from}\n*Konu:* ${msg.subject}`;
          try {
            await bot.api.sendMessage(chatId, emailSummary, {
              parse_mode: "Markdown",
            });
          } catch (tgError) {
            logger.error({ err: tgError }, "Telegram bildirim hatası (Email Summary)");
            // Hata durumunda sade metin gönder
            await bot.api.sendMessage(chatId, `📧 Yeni E-posta\nGönderen: ${msg.from}\nKonu: ${msg.subject}`);
          }

          // 1. Ekleri (Resimleri) Ayır
          const images = msg.attachments?.filter(attr => 
            attr.contentType?.startsWith("image/") || 
            attr.filename.toLowerCase().endsWith(".jpg") || 
            attr.filename.toLowerCase().endsWith(".png") ||
            attr.filename.toLowerCase().endsWith(".jpeg")
          ) || [];

          // 1. Excel Eklerini Kontrol Et
          let excelProcessed = false;
          if (msg.attachments && msg.attachments.length > 0) {
            for (const attr of msg.attachments) {
              if (
                attr.filename.endsWith(".xlsx") ||
                attr.filename.endsWith(".xls")
              ) {
                logger.info(`🔍 Excel dosyası ayrıştırılıyor: ${attr.filename}`);
                const excelRows = await XlsxUtils.parseExcel(attr.content);
                logger.info(`✅ Excel ayrıştırıldı. Satır sayısı: ${excelRows.length}`);
                
                // LLM'e sadece metin verisini gönderiyoruz, resim buffer'larını atlıyoruz
                const promptData = excelRows.map(r => {
                  const copy = { ...r };
                  delete copy._imageBuffer;
                  return copy;
                });
                
                logger.info(`🧠 LLM ayrıştırma başlıyor (parseAndCreateOrder)...`);
                const order = await orderService.parseAndCreateOrder(
                  JSON.stringify(promptData, null, 2),
                  msg.subject,
                  true,
                  excelRows
                );

                  if (order) {
                    // 1. Arşivleme
                    try {
                      await orderService.archiveOrderFile(attr.filename, attr.content);
                    } catch (archErr) {
                      console.error("❌ [FLOW] Arşivleme hatası:", archErr);
                    }

                    // 2. Görsel Hafıza (arka planda)
                    orderService.saveToVisualMemory(order).catch(memErr => {
                      logger.warn({ err: memErr }, "⚠️ Görsel hafıza kaydı başarısız oldu.");
                    });

                    // 3. Departmanları ayır: Otomatik vs Manuel
                    const manualDepts = ["Dikişhane", "Döşemehane"];
                    const autoDepts = Array.from(new Set(order.items.map((i: any) => i.department)))
                      .filter((d: any) => !manualDepts.includes(d)) as string[];
                    const hasManualDepts = order.items.some((i: any) => manualDepts.includes(i.department));

                    // 4. OTOMATİK DEPARTMANLARA HEMEN İŞ EMRİ + RESİM GÖNDER (Karkas, Metal, Ahşap Boya vs.)
                    if (autoDepts.length > 0) {
                      console.log(`🔧 [FLOW] Otomatik dağıtım: ${autoDepts.join(", ")}`);
                      try {
                        await processOrderDistribution(order, images, excelRows, undefined, autoDepts, false);
                        console.log("✅ [FLOW] Otomatik departmanlara iş emri gönderildi");
                      } catch (autoErr) {
                        console.error("❌ [FLOW] Otomatik dağıtım hatası:", autoErr);
                      }
                    }

                    // 5. KUMAŞ BİLGİLERİNİ MARİNA'YA İLET
                    const fabricItems = order.items.filter((i: any) => 
                      i.fabricDetails || (i.details && i.details.toLowerCase().includes("kumaş"))
                    );
                    if (fabricItems.length > 0) {
                      try {
                        let fabricMsg = "🧶 *KUMAŞ SİPARİŞ BİLGİLERİ*\n━━━━━━━━━━━━━━━━━━━━\n";
                        fabricMsg += `👤 *Müşteri:* ${order.customerName}\n\n`;
                        fabricItems.forEach((item: any, idx: number) => {
                          const fabric = item.fabricDetails;
                          fabricMsg += `${idx + 1}. 📦 *${item.product}*\n`;
                          if (fabric) {
                            fabricMsg += `   🧵 Kumaş: ${fabric.name || "Belirtilmedi"}\n`;
                            fabricMsg += `   🎨 Renk: ${fabric.color || "Belirtilmedi"}\n`;
                            if (fabric.amount) fabricMsg += `   📏 Miktar: ${(fabric.amount * (item.quantity || 1)).toFixed(1)} metre\n`;
                          }
                          if (item.details) fabricMsg += `   📝 Not: ${item.details}\n`;
                          fabricMsg += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
                        });
                        await bot.api.sendMessage(marinaId, fabricMsg, { parse_mode: "Markdown" });
                        console.log("✅ [FLOW] Kumaş bilgileri Marina'ya iletildi");
                      } catch (fabricErr) {
                        console.error("❌ [FLOW] Kumaş bilgileri gönderilemedi:", fabricErr);
                      }
                    }

                    // 6. ÜRÜN RESİMLERİNİ MARİNA'YA GÖNDER
                    try {
                      const productPhotos = order.items
                        .filter((i: any) => i.imageBuffer)
                        .reduce((acc: any[], item: any) => {
                          if (!acc.find((a: any) => a._rowIndex === item.rowIndex)) {
                            acc.push({ ...item, _rowIndex: item.rowIndex });
                          }
                          return acc;
                        }, [])
                        .map((item: any, idx: number) => ({
                          type: "photo" as const,
                          media: new InputFile(item.imageBuffer, `urun_${idx + 1}.${item.imageExtension || 'jpg'}`),
                          ...(idx === 0 ? { caption: `📸 Sipariş Görselleri - ${order.customerName}` } : {})
                        }));
                      if (productPhotos.length > 0) {
                        await bot.api.sendMediaGroup(marinaId, productPhotos);
                        console.log(`📸 [FLOW] ${productPhotos.length} ürün resmi Marina'ya gönderildi`);
                      }
                    } catch (imgErr) {
                      console.error("❌ [FLOW] Resim gönderme hatası:", imgErr);
                    }

                    // 7. TASLAK KAYDET + RAPOR
                    const draftId = `draft_${Date.now()}`;
                    draftOrderService.saveDraft(draftId, { order, images, excelRows });
                    const visualReport = orderService.generateVisualTable(order);

                    if (hasManualDepts) {
                      // Dikişhane/Döşemehane varsa → butonlarla personel seçimi sor
                      const needsDikis = order.items.some((i: any) => i.department === "Dikişhane");
                      const needsDoseme = order.items.some((i: any) => i.department === "Döşemehane");
                      const keyboard = new InlineKeyboard();
                      if (needsDikis) keyboard.text("🧵 Dikişçi Seç", `select_dept_staff:${draftId}|Dikişhane`).row();
                      if (needsDoseme) keyboard.text("🪑 Döşemeci Seç", `select_dept_staff:${draftId}|Döşemehane`).row();
                      keyboard.text("❌ İptal Et", `reject_order:${draftId}`);

                      try {
                        await bot.api.sendMessage(marinaId, `📝 *Sipariş Raporu*\n\n${visualReport}\n\n${autoDepts.length > 0 ? `✅ _${autoDepts.join(", ")} bölümlerine iş emirleri gönderildi._\n\n` : ""}*Dikişhane/Döşemehane personel ataması bekleniyor:*`, {
                          parse_mode: "Markdown",
                          reply_markup: keyboard
                        });
                      } catch (tgErr) {
                        await bot.api.sendMessage(marinaId, `📝 Sipariş Raporu\n\n${visualReport}\n\nDikişhane/Döşemehane personel ataması bekleniyor.`, {
                          reply_markup: keyboard
                        }).catch(e => console.error("❌ Taslak gönderilemedi:", e));
                      }
                    } else {
                      // Manuel departman yoksa → doğrudan özet gönder
                      try {
                        await bot.api.sendMessage(marinaId, `✅ *Sipariş Dağıtımı Tamamlandı*\n\n${visualReport}`, { parse_mode: "Markdown" });
                      } catch (tgErr) {
                        console.error("❌ Özet gönderilemedi:", tgErr);
                      }
                    }

                    excelProcessed = true;
                    processedUids.add(msg.uid.toString());
                    logger.info(`✅ Sipariş işleme tamamlandı: ${msg.uid}`);
                  } else {
                    logger.error(`❌ LLM siparişi Excelden okuyamadı veya veriler yetersiz.`);
                    await bot.api.sendMessage(marinaId, `⚠️ E-posta içindeki Excel dosyasından sipariş verisi çıkartılamadı.\nKonu: ${msg.subject}`);
                  }
              }
            }
          }

          // 2. Eğer Excel yoksa veya Excel ayrıştırılamadıysa metin içeriğini ayrıştır
          if (!excelProcessed && msg.content && msg.content.trim().length > 10) {
            logger.info(`📝 Metin içeriği ayrıştırılıyor: ${msg.uid}`);
            const order = await orderService.parseAndCreateOrder(
              msg.content,
              msg.subject,
            );
            if (order) {
              // Görsel Hafıza (arka planda çalışsın, akışı bloklamasın)
              orderService.saveToVisualMemory(order).catch(memErr => {
                logger.warn({ err: memErr }, "⚠️ Görsel hafıza kaydı başarısız oldu.");
              });
              
              const draftId = `draft_${Date.now()}`;
              draftOrderService.saveDraft(draftId, { order, images });

              const visualReport = orderService.generateVisualTable(order);
              const keyboard = new InlineKeyboard()
                .text("🧵 Dikişçi Seç", `select_dept_staff:${draftId}|Dikişhane`).row()
                .text("🪑 Döşemeci Seç", `select_dept_staff:${draftId}|Döşemehane`).row()
                .text("🚀 DAĞITIMI BAŞLAT", `auto_distribute:${draftId}`).row()
                .text("❌ İptal Et", `reject_order:${draftId}`);

              await bot.api.sendMessage(marinaId, `📝 *Yeni Sipariş Taslağı Hazır*\n\n${visualReport}\n\nLütfen dağıtım öncesi personel seçimi yapınız:`, {
                parse_mode: "Markdown",
                reply_markup: keyboard
              });
              logger.info(`⏳ Metin siparişi onay bekliyor: ${msg.uid}`);
            } else {
              logger.error(`❌ LLM siparişi metinden okuyamadı.`);
              await bot.api.sendMessage(marinaId, `⚠️ E-posta içeriğinden sipariş verisi çıkartılamadı.\nKonu: ${msg.subject}`);
            }
          } else if (!excelProcessed) {
              logger.warn(`⚠️ E-posta okundu ancak sipariş olarak tanımlanabilecek bir içerik bulunamadı.`);
              await bot.api.sendMessage(marinaId, `⚠️ Yeni E-posta geldi ancak ne Excel ne de anlamlı bir sipariş metni bulunamadı.\nKonu: ${msg.subject}`);
          }
        });
      } catch (error) {
        logger.error({ err: error }, "Gmail interval check error");
      } finally {
        isProcessingEmail = false;
      }
    },
    60 * 1000
  );
  console.log("📧 Gmail İzleme Aktif Edildi.");
}

// Health Check Sunucusu (Coolify için)
const port = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Sandaluci Assistant is running!\n");
  })
  .listen(port, () => {
    console.log(`📡 Health Check sunucusu ${port} portunda aktif.`);
  });

// Botu Başlat
console.log("🚀 Ayça Asistan Ayağa Kalkıyor...");
// Sunucuyu başlat
bot.start();
