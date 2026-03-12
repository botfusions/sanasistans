import { Bot, InlineKeyboard, InputFile } from "grammy";
import * as fs from "fs";
import * as path from "path";
import http from "http";
import * as dotenv from "dotenv";
import { MessageHandler } from "./handlers/message.handler";
import { CommandHandler } from "./handlers/command.handler";
import { OrderService } from "./utils/order.service";
import { StaffService } from "./utils/staff.service";
import { XlsxUtils } from "./utils/xlsx-utils";
import { DraftOrderService } from "./utils/draft-order.service";
import { Language, t, getUserLanguage } from "./utils/i18n";
import { DoctorService } from "./utils/doctor.service";
import { logger } from "./utils/logger";

// --- Dinamik Ayarlar ve Yardımcılar ---
const MANUAL_DEPARTMENTS = ["Dikişhane", "Döşemehane"];

const getDeptButtonLabel = (dept: string, isAssigned: boolean = false) => {
  const action = isAssigned ? "Değiştir" : "Seç";
  if (dept === "Dikişhane") return `Dikişçi ${action}`;
  if (dept === "Döşemehane") return `Döşemeci ${action}`;
  return `${dept} ${action}`;
};

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

// Mükerrer mesaj kontrolü için son gönderilen mesajları takip et
const recentMessages = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 5000; // 5 saniye içinde aynı mesajı tekrar gönderme

function generateMessageHash(content: string, targetId: string): string {
  return `${targetId}_${content.length}_${content.substring(0, 50)}`;
}

async function sendMessageWithDuplicateCheck(
  targetId: number,
  message: string,
  options?: any,
): Promise<void> {
  const hash = generateMessageHash(message, targetId.toString());
  const now = Date.now();
  const lastSent = recentMessages.get(hash);

  if (lastSent && now - lastSent < DUPLICATE_WINDOW_MS) {
    logger.warn(
      { targetId, hash },
      "Mükerrer mesaj engellendi (5sn içinde tekrar)",
    );
    return;
  }

  recentMessages.set(hash, now);
  await bot.api.sendMessage(targetId, message, options);

  // Eski kayıtları temizle (10 dakikadan eski)
  const tenMinutesAgo = now - 10 * 60 * 1000;
  for (const [key, timestamp] of recentMessages.entries()) {
    if (timestamp < tenMinutesAgo) {
      recentMessages.delete(key);
    }
  }
}

const supervisorId =
  allowlist[0] && allowlist[0] !== "" ? allowlist[0] : chatId || "";
const marinaId = supervisorId; // Test aşamasında her iki rol de Patron/Süpervizör ID'sinde
const marinaLang: Language = "ru";

console.log(`👤 Sistem Yöneticisi (Patron): ${supervisorId}`);
console.log(`👤 Sipariş Onay Yetkilisi (Geçici): ${marinaId}`);

// Güvenlik & Rol Yönetimi Katmanı
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const staffMember = staffService.getStaffByTelegramId(userId);
  const isBoss = staffService.isBoss(userId);
  const isRegisteredStaff = !!staffMember;
  const username = ctx.from?.username || "Bilinmiyor";

  // Context'e rol bilgisini ekleyelim
  (ctx as any).role = isBoss ? "boss" : isRegisteredStaff ? "staff" : "guest";
  (ctx as any).staffInfo = staffMember;

  const isRegisterCommand = ctx.message?.text?.startsWith("/kayit");
  const isStartCommand = ctx.message?.text?.startsWith("/start");

  if (isBoss || isRegisteredStaff || isRegisterCommand || isStartCommand) {
    return next();
  }

  // Yetkisiz erişim logu - Botun neden cevap vermediğini anlamak için kritik
  console.log(
    `⚠️  YETKİSİZ ERİŞİM: UserID=${userId}, Username=@${username}, Role=${(ctx as any).role}, Text=${ctx.message?.text || "Mesaj metni yok"}`,
  );

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
    return ctx.reply(
      "❌ Bu komut sadece Barış Bey (SuperAdmin) için yetkilendirilmiştir.",
    );
  }
  const statusMsg = await ctx.reply(
    "🩺 <b>Sistem damarları kontrol ediliyor...</b> Lütfen bekleyin.",
    { parse_mode: "HTML" },
  );
  const report = await doctorService.checkSystem();
  await bot.api.editMessageText(
    ctx.chat.id,
    statusMsg.message_id,
    `🩺 <b>Sistem Kontrol Raporu</b>\n\n${report}`,
    { parse_mode: "HTML" },
  );
});

// Metin Mesajı Handlerı
bot.on("message:text", (ctx) => messageHandler.handle(ctx));

// Callback Query Handlerı
// Callback Query Handlerı (Merkezi Mantık - index.ts)
bot.callbackQuery(/^select_dept_staff:(.+)\|(.+)$/, async (ctx) => {
  const draftId = ctx.match[1] as string;
  const deptName = ctx.match[2] as string;
  const staffList = staffService.getStaffByDepartment(deptName);
  if (staffList.length === 0) {
    return ctx.answerCallbackQuery(`⚠️ ${deptName} için kayıtlı personel bulunamadı.`);
  }

  const keyboard = new InlineKeyboard();
  staffList.forEach((s) => {
    keyboard.text(s.name, `aw:${draftId}:${deptName}:${s.name}`).row();
  });
  keyboard.text("🔙 Geri", `back_to_draft:${draftId}`);

  await ctx.editMessageText(
    `👤 <b>${deptName}</b> için personel seçin:\n\n<i>Lütfen listeden bir isim seçin.</i>`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^aw:(.+):(.+):(.+)$/, async (ctx) => {
  const draftId = ctx.match[1] as string;
  const deptName = ctx.match[2] as string;
  const staffName = ctx.match[3] as string;

  const draft = draftOrderService.getDraft(draftId);
  if (!draft)
    return ctx.answerCallbackQuery("❌ Taslak bulunamadı veya süresi doldu.");

  // Taslaktaki o departmana ait TÜM kalemlere bu işçiyi ata
  draft.order.items.forEach((item: any) => {
    if (item.department === deptName) {
      item.assignedWorker = staffName;
      item.status = "uretimde";
      item.distributedAt = new Date().toISOString();
    }
  });

  await ctx.answerCallbackQuery(`${staffName} atandı.`);

  // Marina'ya güncel durumu göster
  const visualReport = orderService.generateVisualTable(draft.order);
  const keyboard = new InlineKeyboard();

  const remainingDepts = Array.from(
    new Set(
      draft.order.items
        .filter(
          (i: any) =>
            MANUAL_DEPARTMENTS.includes(i.department) && !i.assignedWorker,
        )
        .map((i: any) => i.department),
    ),
  );

  remainingDepts.forEach((d: any) => {
    keyboard.text(getDeptButtonLabel(d, false), `select_dept_staff:${draftId}|${d}`).row();
  });

  if (remainingDepts.length === 0) {
    keyboard
      .text("🚀 ÜRETİMİ BAŞLAT (FINALIZE)", `finalize_dist:${draftId}`)
      .row();
  }
  keyboard.text("❌ İptal", `reject_order:${draftId}`);

  await ctx.editMessageText(
    `✅ ${deptName} -> <b>${staffName}</b> atandı.\n\n${visualReport}`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    },
  );
});

bot.callbackQuery(/^finalize_dist:(.+)$/, async (ctx) => {
  const draftId = ctx.match[1] as string;
  const draft = draftOrderService.getDraft(draftId);
  if (!draft) return ctx.answerCallbackQuery("❌ Taslak bulunamadı.");

  const unassignedManualDepts = Array.from(
    new Set(
      draft.order.items
        .filter(
          (i: any) =>
            ["Dikişhane", "Döşemehane"].includes(i.department) &&
            !i.assignedWorker,
        )
        .map((i: any) => i.department),
    ),
  );

  if (unassignedManualDepts.length > 0) {
    return ctx.answerCallbackQuery(
      `⚠️ Lütfen önce personelleri seçin: ${unassignedManualDepts.join(", ")}`,
    );
  }

  await ctx.answerCallbackQuery("🚀 Üretim başlatılıyor...");

  // 1. Manuel departmanlara PDF'leri gönder
  const assignedDepts = Array.from(
    new Set(
      draft.order.items
        .filter((i: any) => i.assignedWorker)
        .map((i: any) => i.department as string),
    ),
  ) as string[];

  // Sadece Manuel olanları filtreleyelim
  const onlyManual = assignedDepts.filter((d) =>
    MANUAL_DEPARTMENTS.includes(d),
  );

  if (onlyManual.length > 0) {
    await processOrderDistribution(
      draft.order,
      draft.images || [],
      draft.excelRows || [],
      undefined,
      onlyManual,
      false,
    );
  }

  // 2. Marina'ya final raporunu 20 saniye sonra gönder
  setTimeout(async () => {
    try {
      console.log(`🕒 [FLOW] Final raporu için 20 saniye beklendi, şimdi gönderiliyor... (${draft.order.orderNumber})`);
      const summaryPdf = await orderService.generateMarinaSummaryPDF(draft.order);
      await bot.api.sendDocument(
        marinaId,
        new InputFile(summaryPdf, `Final_Rapor_${draft.order.orderNumber}.pdf`),
        {
          caption: `✅ <b>Sipariş Dağıtımı Tamamlandı</b>\n\n📌 Sipariş No: ${draft.order.orderNumber}\n👤 Müşteri: ${draft.order.customerName}\n\n📄 <b>SİPARİŞ ÖZET RAPORU / ОТЧЕТ ПО ЗАКАЗУ</b> (PDF)`,
          parse_mode: "HTML",
        },
      );
    } catch (finalErr) {
      console.error("❌ Final rapor gönderme hatası:", finalErr);
    }
  }, 20000);

  await ctx.editMessageText(
    `✅ Üretim süreci başlatıldı ve PDF'ler ilgili birimlere iletildi.`,
  );
  draftOrderService.removeDraft(draftId);
});

bot.callbackQuery(/^auto_distribute:(.+)$/, async (ctx) => {
  // auto_distribute butonu finalize_dist ile aynı işi görsün
  const draftId = ctx.match[1] as string;
  const draft = draftOrderService.getDraft(draftId);
  if (!draft) return ctx.answerCallbackQuery("❌ Taslak bulunamadı.");

  // Eğer hiç manuel departman yoksa direkt finalize et
  const hasManual = draft.order.items.some((i: any) =>
    MANUAL_DEPARTMENTS.includes(i.department),
  );
  if (!hasManual) {
    // finalize_dist logic
    const summaryPdf = await orderService.generateMarinaSummaryPDF(draft.order);
    await bot.api.sendDocument(
      marinaId,
      new InputFile(summaryPdf, `Final_Rapor_${draft.order.orderNumber}.pdf`),
      {
        caption: `✅ <b>Sipariş Dağıtımı Tamamlandı</b>`,
        parse_mode: "HTML",
      },
    );
    await ctx.editMessageText("✅ Sipariş dağıtıldı.");
    draftOrderService.removeDraft(draftId);
  } else {
    await ctx.answerCallbackQuery(
      "⚠️ Lütfen önce manuel departmanlar için personel seçin.",
    );
  }
});

bot.callbackQuery(/^back_to_draft:(.+)$/, async (ctx) => {
  const draftId = ctx.match[1] as string;
  const draft = draftOrderService.getDraft(draftId);
  if (!draft) return ctx.answerCallbackQuery("❌ Taslak bulunamadı.");

  const visualReport = orderService.generateVisualTable(draft.order);
  const keyboard = new InlineKeyboard();

  const deptsInOrder = Array.from(
    new Set(draft.order.items.map((i: any) => i.department as string)),
  ) as string[];
  const relevantManual = deptsInOrder.filter((d) => MANUAL_DEPARTMENTS.includes(d));

  relevantManual.forEach((d) => {
    const isAssigned = draft.order.items.some(
      (i: any) => i.department === d && i.assignedWorker,
    );
    keyboard.text(getDeptButtonLabel(d, isAssigned), `select_dept_staff:${draftId}|${d}`).row();
  });

  const remaining = draft.order.items.filter(
    (i: any) => MANUAL_DEPARTMENTS.includes(i.department) && !i.assignedWorker,
  );
  if (remaining.length === 0) {
    keyboard
      .text("🚀 ÜRETİMİ BAŞLAT (FINALIZE)", `finalize_dist:${draftId}`)
      .row();
  }
  keyboard.text("❌ İptal", `reject_order:${draftId}`);

  await ctx.editMessageText(`📝 <b>Sipariş Taslağı</b>\n\n${visualReport}`, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^reject_order:(.+)$/, async (ctx) => {
  const draftId = ctx.match[1] as string;
  draftOrderService.removeDraft(draftId);
  await ctx.editMessageText("❌ Sipariş taslağı iptal edildi.");
  await ctx.answerCallbackQuery();
});

// --- Kumaş Kontrol Butonları ---
bot.callbackQuery(/^fabric_ok:(.+)$/, async (ctx) => {
  const itemId = ctx.match[1];
  const lang = getUserLanguage((ctx as any).role);
  await orderService.updateItemStatus(itemId, "uretimde");
  await ctx.editMessageText(`✅ ${t("fabric_ok_msg", lang)}`);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^fabric_fail:(.+)$/, async (ctx) => {
  const lang = getUserLanguage((ctx as any).role);
  await ctx.editMessageText(`⚠️ ${t("fabric_fail_msg", lang)}`);
  await ctx.answerCallbackQuery();
});

bot.on("callback_query:data", (ctx) => messageHandler.handleCallback(ctx));

/**
 * OTOMATİK DEĞERLENDİRME VE DAĞITIM YARDIMCI FONKSİYONU
 */
async function processOrderDistribution(
  order: any,
  images: any[],
  excelRows: any[],
  manualAssignments: Record<string, number> | undefined,
  targetDepts: string[],
  isDraft: boolean = false,
) {
  for (const currentDept of targetDepts) {
    const deptItems = order.items.filter(
      (i: any) => i.department === currentDept,
    );
    if (deptItems.length === 0) continue;

    const deptMsg = orderService.generateDeptView(
      deptItems,
      order.customerName as string,
      currentDept,
    );

    try {
      const pdfBuffer = await orderService.generateJobOrderPDF(
        deptItems as any[],
        order.customerName || "Bilinmiyor / Неизвестно",
        currentDept,
      );
      await orderService.archivePDF(currentDept, pdfBuffer);
      const pdfViewBuffer = await orderService.generatePDFView(pdfBuffer);

      const safeCustomerName = (order.customerName || "Bilinmiyor")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 30);
      const pdfFileName = `${safeCustomerName}_${currentDept}_Is_Emri.pdf`;

      let targetIds: number[] = [];

      // Eğer itemlarda atanmış bir işçi varsa (özellikle manuel departmanlar için)
      const assignedWorkerName = deptItems.find(
        (i: any) => i.assignedWorker,
      )?.assignedWorker;

      if (assignedWorkerName) {
        const staff = staffService
          .getAllStaff()
          .find((s) => s.name === assignedWorkerName);
        if (staff?.telegramId) {
          targetIds = [staff.telegramId];
        }
      }

      // Eğer hala boşsa (otomatik departmanlar veya atama yapılmamışsa)
      if (targetIds.length === 0) {
        if (manualAssignments && manualAssignments[currentDept]) {
          targetIds = [manualAssignments[currentDept]];
        } else {
          const departmentalStaffIds = staffService
            .getStaffByDepartment(currentDept)
            .map((s) => s.telegramId)
            .filter((id) => !!id) as number[];

          targetIds =
            departmentalStaffIds.length > 0
              ? departmentalStaffIds
              : [parseInt(marinaId)];
        }
      }

      for (const targetId of targetIds) {
        if (!targetId) continue;

        const staff = staffService.getStaffByTelegramId(targetId);
        const lang = staff?.language || "ru";

        // PDF Önizleme ve metin mesajını HTML olarak gönder
        await bot.api.sendPhoto(
          targetId,
          new InputFile(pdfViewBuffer, `job_order.png`),
          {
            caption: deptMsg,
            parse_mode: "HTML",
          },
        );

        try {
          await bot.api.sendDocument(
            targetId,
            new InputFile(pdfBuffer, pdfFileName),
            {
              caption: `📄 <b>${currentDept}</b> - ${lang === "ru" ? "Заказ на производство" : "İş Emri Dosyası"} (PDF)`,
              parse_mode: "HTML",
            },
          );
        } catch (pdfSendErr) {
          logger.error(
            { err: pdfSendErr, dept: currentDept },
            "❌ PDF dosyası gönderilemedi.",
          );
        }

        // ESKİ MANUEL ATAMA LANTIĞI (DRAFT FLOW İLE DEĞİŞTİ - İHTİYAÇ KALMADI)
        // Sadece Kumaş ve Statü güncelleme kısımları kalsın



        if (staff) {
          for (const dItem of deptItems) {
            if (dItem.status === "bekliyor") {
              await orderService.updateItemStatus(dItem.id, "uretimde");
            }
          }
        }
      }
    } catch (distError) {
      logger.error({ err: distError, dept: currentDept }, "Dağıtım hatası");
    }
  }
}

/**
 * GMAIL VE SIPARIS FLOW KATMANI
 */
if (process.env.GMAIL_ENABLED !== "false") {
  const UID_STORE_PATH = path.join(
    process.cwd(),
    "data",
    "processed_uids.json",
  );
  const processedUids = new Set<string>();

  // GmailService'i içe aktar ama IIFE kullanma (zaten dosya modül seviyesinde esnext/es2022 ise sorun yok,
  // ancak tsc hatası veriyorsa inline require veya dinamik import'u fonksiyon içine alabiliriz)
  let gmailService: any;

  function loadProcessedUids() {
    try {
      if (fs.existsSync(UID_STORE_PATH)) {
        const data = fs.readFileSync(UID_STORE_PATH, "utf-8");
        const uids = JSON.parse(data);
        uids.forEach((uid: string) => processedUids.add(uid));
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

  setInterval(async () => {
    if (isProcessingEmail) {
      logger.warn("⏳ Önceki e-posta işleme henüz bitmedi, döngü atlanıyor.");
      return;
    }
    isProcessingEmail = true;

    try {
      if (!gmailService) {
        const { GmailService } = await import("./utils/gmail.service");
        gmailService = GmailService.getInstance();
      }
      logger.info("🔍 Gmail kontrol ediliyor...");
      // The instruction for gmail.service.ts cannot be applied here as this file only calls the service.
      // The `processUnreadMessages` method itself would need to be modified in `gmail.service.ts`.
      // Assuming the instruction implies that `processUnreadMessages` should internally use `seen: false`.
      await gmailService.processUnreadMessages(1, async (msg: any) => {
        if (processedUids.has(msg.uid.toString())) {
          logger.info(`🔄 UID ${msg.uid} zaten işlendi, atlanıyor.`);
          return;
        }

        const skipDomains = [
          "groq.co",
          "supabase.com",
          "github.com",
          "google.com",
          "newsletter",
        ];
        if (
          skipDomains.some((domain) => msg.from.toLowerCase().includes(domain))
        ) {
          logger.info(
            `🧹 Sistem maili atlanıyor: ${msg.subject} (${msg.from})`,
          );
          processedUids.add(msg.uid.toString());
          saveProcessedUids();
          return;
        }

        logger.info(
          `📩 Yeni e-posta işleniyor: ${msg.subject} (UID: ${msg.uid})`,
        );

        // İşlemi en başta işaretle ki poll döngüsü tekrar tetiklemesin
        processedUids.add(msg.uid.toString());
        saveProcessedUids();

        const emailSummary = `📧 <b>Yeni E-posta</b> \n\n<b>Gönderen:</b> ${OrderService.escapeHTML(msg.from)}\n<b>Konu:</b> ${OrderService.escapeHTML(msg.subject)}`;
        logger.info(`💬 Telegram bildirimi gönderiliyor: ${chatId}`);
        try {
          if (chatId) {
            await sendMessageWithDuplicateCheck(
              parseInt(chatId),
              emailSummary,
              { parse_mode: "HTML" },
            );
            console.log("✅ E-posta özeti Telegram'a gönderildi.");
          }
        } catch (tgError) {
          logger.error(
            { err: tgError },
            "Telegram bildirim hatası (Email Summary)",
          );
        }

        const images =
          msg.attachments?.filter(
            (attr: any) =>
              attr.contentType?.startsWith("image/") ||
              /\.(jpg|png|jpeg)$/i.test(attr.filename),
          ) || [];

        let excelProcessed = false;
        if (msg.attachments && msg.attachments.length > 0) {
          for (const attr of msg.attachments) {
            if (/\.xlsx?$/i.test(attr.filename)) {
              logger.info(`🔍 Excel dosyası ayrıştırılıyor: ${attr.filename}`);
              const excelRows = await XlsxUtils.parseExcel(attr.content);
              const promptData = excelRows.map((r: any) => {
                const copy = { ...r };
                delete copy._imageBuffer;
                return copy;
              });

              const order = await orderService.parseAndCreateOrder(
                msg.subject,
                JSON.stringify(promptData, null, 2),
                msg.uid.toString(),
                msg.attachments,
              );

              if (!order) {
                console.log("⚠️ Sipariş ayrıştırılamadı (order is null)");
                continue;
              }

              if (order.isDuplicate) {
                logger.info(
                  { orderNumber: (order as any).orderNumber },
                  "⏭️ Mükerrer sipariş atlanıyor.",
                );
                continue;
              }

              console.log(
                `🚀 [FLOW] Sipariş işleme süreci başlıyor: ${order.orderNumber}`,
              );

              try {
                await orderService.archiveOrderFile(
                  attr.filename,
                  attr.content,
                );
              } catch (archErr) {
                console.error("❌ [FLOW] Arşivleme hatası:", archErr);
              }

              orderService
                .saveToVisualMemory(order)
                .catch((e) =>
                  logger.warn({ err: e }, "⚠️ Görsel hafıza hatası."),
                );

              // Gerekli değişkenlerin tanımlanması
              const draftId = `draft_${Date.now()}`;
              draftOrderService.saveDraft(draftId, { order, images });

              const visualReport = orderService.generateVisualTable(order);
              const marinaId = process.env.TELEGRAM_CHAT_ID;
              if (!marinaId) {
                console.error("❌ TELEGRAM_CHAT_ID eksik!");
                continue;
              }

              const fabricItems = order.items.filter((i: any) =>
                i.department.toLowerCase().includes("kumaş"),
              );
              const hasManualDepts = order.items.some((i: any) =>
                MANUAL_DEPARTMENTS.includes(i.department),
              );

              // PDF Önizleme Resmi Oluşturma (Opsiyonel)
              let pdfPreviewImg: Buffer | undefined;
              try {
                // Burada preview generation logic varsa eklenebilir, şimdilik undefined
              } catch (e) {}

              const autoDepts = Array.from(
                new Set(order.items.map((i: any) => i.department)),
              ).filter((d: any) => !MANUAL_DEPARTMENTS.includes(d)) as string[];

              // --- SİLSİLE (TIMING) BAŞLANGICI ---
              
              // 1. ADIM: 20 Saniye sonra OTOMATİK departmanlara gönder
              if (autoDepts.length > 0) {
                setTimeout(async () => {
                  try {
                    console.log(`🕒 [FLOW] Otomatik birimler için 20 saniye beklendi, gönderiliyor... (${order.orderNumber})`);
                    await processOrderDistribution(
                      order,
                      images,
                      excelRows,
                      undefined,
                      autoDepts,
                      false,
                    );
                  } catch (autoErr) {
                    console.error("❌ [FLOW] Otomatik dağıtım hatası:", autoErr);
                  }
                }, 20000);
              }

              // 2. ADIM: 40 Saniye sonra MARINA'ya bildirim/seçim gönder
              setTimeout(async () => {
                const autoInfo = autoDepts.length > 0 ? `\n\n✅ <b>Birimlere İş Emirleri Gönderildi:</b> ${autoDepts.join(", ")}` : "";
                
                if (hasManualDepts) {
                  const keyboard = new InlineKeyboard();
                  const deptsToAssign = Array.from(
                    new Set(
                      order.items
                        .filter((i: any) => MANUAL_DEPARTMENTS.includes(i.department))
                        .map((i: any) => i.department as string)
                    )
                  );
                  
                  deptsToAssign.forEach(d => {
                    keyboard.text(getDeptButtonLabel(d, false), `select_dept_staff:${draftId}|${d}`).row();
                  });
                  
                  keyboard.text("🚀 DAĞITIMI BAŞLAT", `auto_distribute:${draftId}`).row();
                  keyboard.text("❌ İptal Et", `reject_order:${draftId}`);

                  const reportCaption = `📝 <b>Sipariş Raporu</b>\n\n${visualReport}${autoInfo}\n\n<b>Personel ataması bekleniyor:</b>`;
                  console.log(`🕒 [FLOW] Marina seçimi için 40 saniye beklendi, gönderiliyor... (${order.orderNumber})`);

                  if (pdfPreviewImg) {
                    await bot.api.sendPhoto(marinaId, new InputFile(pdfPreviewImg, "preview.png"), {
                      caption: reportCaption,
                      parse_mode: "HTML",
                      reply_markup: keyboard,
                    });
                  } else {
                    await bot.api.sendMessage(marinaId, reportCaption, {
                      parse_mode: "HTML",
                      reply_markup: keyboard,
                    });
                  }
                } else {
                  // Manuel birim yoksa sadece özet gönder
                  const finalMsg = `✅ <b>Sipariş Dağıtımı Tamamlandı</b>\n\n${visualReport}${autoInfo}`;
                  console.log(`🕒 [FLOW] Final özet için 40 saniye beklendi, gönderiliyor... (${order.orderNumber})`);
                  
                  try {
                    const summaryPdf = await orderService.generateMarinaSummaryPDF(order);
                    await bot.api.sendDocument(marinaId, new InputFile(summaryPdf, `Siparis_Ozeti_${order.orderNumber}.pdf`), {
                      caption: `${finalMsg}\n\n📄 <b>SİPARİŞ ÖZET RAPORU / ОТЧЕТ ПО ЗАКАЗУ</b> (PDF)`,
                      parse_mode: "HTML",
                    });
                  } catch (sumErr) {
                    if (pdfPreviewImg) {
                      await bot.api.sendPhoto(marinaId, new InputFile(pdfPreviewImg, "preview.png"), {
                        caption: finalMsg,
                        parse_mode: "HTML",
                      });
                    } else {
                      await bot.api.sendMessage(marinaId, finalMsg, { parse_mode: "HTML" });
                    }
                  }
                }
              }, 40000);

              // 3. ADIM: 60 Saniye sonra KUMAŞ BİLGİSİ gönder
              if (fabricItems.length > 0) {
                setTimeout(async () => {
                  try {
                    console.log(`🕒 [FLOW] Kumaş raporu için 60 saniye beklendi, gönderiliyor... (${order.orderNumber})`);
                    const fabricPdf = await orderService.generateFabricOrderPDF(order);
                    await bot.api.sendDocument(marinaId, new InputFile(fabricPdf, `Kumas_Siparisi_${order.orderNumber}.pdf`), {
                      caption: "🧶 <b>KUMAŞ SİPARİŞ RAPORU / ЗАКАЗ ТКАНИ</b> (PDF)",
                      parse_mode: "HTML",
                    });
                  } catch (fErr) {
                    console.error("❌ Kumaş PDF hatası:", fErr);
                  }
                }, 60000);
              }

              excelProcessed = true;
              processedUids.add(msg.uid.toString());
              saveProcessedUids();
            }
          }
        }

        if (!excelProcessed && msg.content && msg.content.trim().length > 10) {
          const order = await orderService.parseAndCreateOrder(
            msg.subject,
            msg.content,
            msg.uid.toString(),
            msg.attachments,
          );
          if (order) {
            const draftId = `draft_${Date.now()}`;
            draftOrderService.saveDraft(draftId, { order, images });
            const visualReport = orderService.generateVisualTable(order);
            const marinaId = process.env.TELEGRAM_CHAT_ID || "";
            
            const keyboard = new InlineKeyboard();
            const deptsToAssign = Array.from(
              new Set(
                order.items
                  .filter((i: any) => MANUAL_DEPARTMENTS.includes(i.department))
                  .map((i: any) => i.department as string)
              )
            );
            
            deptsToAssign.forEach(d => {
              keyboard.text(getDeptButtonLabel(d, false), `select_dept_staff:${draftId}|${d}`).row();
            });
            
            keyboard.text("🚀 DAĞITIMI BAŞLAT", `auto_distribute:${draftId}`).row();
            keyboard.text("❌ İptal Et", `reject_order:${draftId}`);
            const autoDepts = Array.from(
              new Set(order.items.map((i: any) => i.department)),
            ).filter((d: any) => !MANUAL_DEPARTMENTS.includes(d)) as string[];

            // 1. ADIM: 20 saniye sonra OTOMATİK birimler (Text)
            if (autoDepts.length > 0) {
              setTimeout(async () => {
                try {
                  console.log(`🕒 [FLOW] (Text) Otomatik birimler için 20 saniye beklendi... (${order.orderNumber})`);
                  await processOrderDistribution(order, images, [], undefined, autoDepts, false);
                } catch (distErr) {
                  logger.error({ err: distErr }, "Otomatik dağıtım hatası (Text)");
                }
              }, 20000);
            }

            // 2. ADIM: 40 saniye sonra Marina bildirimi (Text)
            setTimeout(async () => {
              const autoInfo = autoDepts.length > 0 ? `\n\n✅ <b>Birimlere İş Emirleri Gönderildi:</b> ${autoDepts.join(", ")}` : "";
              const reportCaption = `📝 <b>Sipariş Raporu</b>\n\n${visualReport}${autoInfo}`;
              console.log(`🕒 [FLOW] (Text) Marina bildirimi için 40 saniye beklendi... (${order.orderNumber})`);
              
              if (marinaId) {
                await bot.api.sendMessage(marinaId, reportCaption, {
                  parse_mode: "HTML",
                  reply_markup: keyboard,
                });
              }
            }, 40000);
          }
        }

        processedUids.add(msg.uid.toString());
        saveProcessedUids();
      });
    } catch (e) {
      logger.error({ err: e }, "Gmail check error");
    } finally {
      isProcessingEmail = false;
    }
  }, 60 * 1000);
}

// Sunucu Başlatma
const port = Number(process.env.PORT) || 3000;
const botEnabled = process.env.BOT_ENABLED !== "false";
if (botEnabled) {
  const httpPort = Number(process.env.PORT) || 3000;
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200);
      res.end("OK");
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(httpPort, "0.0.0.0", () => {
    console.log(`📡 Health check server on port ${httpPort}`);
    bot.start().catch((e) => console.error("Bot start error:", e));
  });
}
