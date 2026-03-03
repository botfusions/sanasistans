import { Bot, InputFile, InlineKeyboard } from "grammy";
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
const staffService = new StaffService();
const orderService = new OrderService();
const messageHandler = new MessageHandler();
const commandHandler = new CommandHandler();

// Güvenlik & Rol Yönetimi Katmanı
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const isBoss = allowlist.includes(userId.toString());
  const staffMember = staffService.getStaffByTelegramId(userId);
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
      "Merhaba! Ben Ayça. 🙋‍♀️ Şu an sadece Cenk Bey ve kayıtlı Sandaluci personeline hizmet veriyorum.\n\nEğer ekipten biriysen lütfen `/kayit İsim | Departman` komutuyla kendini tanıtır mısın?",
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
bot.command("test_briefing", (ctx) => commandHandler.handleTestBriefing(ctx));

// Normal Mesajlar
bot.on("message", (ctx) => messageHandler.handle(ctx));

// --- BUTON TIKLAMALARI (CALLBACK QUERY) ---
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const [action, itemId, workerName] = data.split(":");

  try {
    if (action === "assign_worker") {
      const success = await orderService.assignWorkerToItem(itemId, workerName);
      if (success) {
        const itemInfo = orderService.getOrderItemById(itemId);
        await ctx.answerCallbackQuery(`✅ İş ${workerName} personeline atandı.`);
        await ctx.editMessageCaption({
          caption: `✅ *Döşeme İşçisi Seçildi:* ${workerName}\nSipariş: ${itemInfo?.order.customerName}\nÜrün: ${itemInfo?.item.product}`,
          parse_mode: "Markdown"
        });
        
        // İşçiye özel bildirim (Eğer kayıtlıysa)
        const worker = staffService.getStaffByName(workerName);
        if (worker && worker.telegramId) {
          await bot.api.sendMessage(worker.telegramId, `🔔 *YENİ GÖREV (Parça Başı)*\n\nMüşteri: ${itemInfo?.order.customerName}\nÜrün: ${itemInfo?.item.product}\nMiktar: ${itemInfo?.item.quantity}\n\nLütfen iş bitince bildirmeyi unutma!`);
        }
      }
    } else if (action === "fabric_ok" || action === "fabric_fail") {
      const arrived = action === "fabric_ok";
      await orderService.updateFabricStatus(itemId, arrived);
      await ctx.answerCallbackQuery(arrived ? "✅ Kumaş onaylandı." : "⚠️ Sorun bildirildi.");
      
      const itemInfo = orderService.getOrderItemById(itemId);
      await ctx.editMessageCaption({
        caption: `🧵 *Kumaş Durumu:* ${arrived ? "✅ GELDİ" : "❌ SORUN VAR"}\nSipariş: ${itemInfo?.order.customerName}\nÜrün: ${itemInfo?.item.product}`,
        parse_mode: "Markdown"
      });

      // Eğer sorun varsa Marina'ya bildir
      if (!arrived) {
        await bot.api.sendMessage(allowlist[0], `⚠️ *DİKKAT (KUMAŞ SORUNU)*\n\nAlmira bildirdi: ${itemInfo?.order.customerName} siparişindeki ${itemInfo?.item.product} için kumaş henüz gelmedi veya eksik!`);
      }
    }
  } catch (err) {
    logger.error({ err }, "Callback query error");
    await ctx.answerCallbackQuery("❌ Bir hata oluştu.");
  }
});

// Cron Servisi (Eğer chatId verilmişse başlat)
if (chatId) {
  const cronService = new CronService(bot, chatId);
  cronService.init();
  console.log("📅 Cron Servisi Aktif Edildi.");

  // Gmail Servisi ve Periyodik Kontrol (Her 5 dakikada bir)
  const gmailService = GmailService.getInstance();
  setInterval(
    async () => {
      try {
        await gmailService.processUnreadMessages(5, async (msg) => {
          logger.info(`📧 Yeni e-posta işleniyor: ${msg.subject} (UID: ${msg.uid})`);
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
                const excelRows = await XlsxUtils.parseExcel(attr.content);
                // LLM'e sadece metin verisini gönderiyoruz, resim buffer'larını atlıyoruz
                const promptData = excelRows.map(r => {
                  const copy = { ...r };
                  delete copy._imageBuffer;
                  return copy;
                });
                
                const order = await orderService.parseAndCreateOrder(
                  JSON.stringify(promptData, null, 2),
                  msg.subject,
                  true,
                  excelRows
                );

                if (order) {
                  // Arşivleme
                  await orderService.archiveOrderFile(attr.filename, attr.content);
                  // Görsel Hafıza
                  await orderService.saveToVisualMemory(order);
                  
                  await processOrderDistribution(order, images, excelRows);
                  excelProcessed = true;
                  logger.info(`✅ Excel siparişi işlendi: ${msg.uid}`);
                }
              }
            }
          }

          // 2. Eğer Excel yoksa metin içeriğini ayrıştır
          if (!excelProcessed && msg.content) {
            logger.info(`📝 Metin içeriği ayrıştırılıyor: ${msg.uid}`);
            const order = await orderService.parseAndCreateOrder(
              msg.content,
              msg.subject,
            );
            if (order) {
              // Metin siparişi için de (varsa resimler) görsel hafızayı dene
              await orderService.saveToVisualMemory(order);
              
              await processOrderDistribution(order, images);
              logger.info(`✅ Metin siparişi işlendi: ${msg.uid}`);
            }
          }
        });

        // Yardımcı Fonksiyon: Sipariş Dağıtımını Yönetir
        async function processOrderDistribution(order: any, emailImages: any[], excelRows?: any[]) {
          const marinaId = allowlist[0];
          const departments = Array.from(new Set(order.items.map((i: any) => i.department)));

          for (const dept of departments) {
            const deptItems = order.items.filter((i: any) => i.department === dept);
            const currentDept = dept as string;

            // Excel resimlerini personelle eşleştir (Daha önce yapılmış ama garantiye alalım)
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
              // PDF oluştur ve Arşivle (Core yapıda var)
              const pdfBuffer = await orderService.generateJobOrderPDF(deptItems, order.customerName || "Belirtilmedi", currentDept);
              await orderService.archivePDF(currentDept, pdfBuffer);
              const pdfViewBuffer = await orderService.generatePDFView(pdfBuffer);

              const staffMembers = staffService.getStaffByDepartment(currentDept);
              const targetIds = staffMembers.length > 0 ? staffMembers.map(s => s.telegramId).filter(id => !!id) : [marinaId];

              const productImages = deptItems.filter((i: any) => i.imageBuffer).map((item: any, idx: number) => ({
                type: "photo" as const,
                media: new InputFile(item.imageBuffer, `p_${idx}.${item.imageExtension || 'jpg'}`)
              }));

              // --- INTERAKTIF BUTONLAR VE ÖZEL BİLDİRİMLER ---
              for (const targetId of targetIds) {
                if (!targetId) continue;

                // 1. DÖŞEME ÖZEL: Marina'ya işçi seçme butonları
                if (currentDept === "Döşeme") {
                  for (const item of deptItems) {
                    const keyboard = new InlineKeyboard()
                      .text("Aydın", `assign_worker:${item.id}:Aydın`)
                      .text("Uğur", `assign_worker:${item.id}:Uğur`)
                      .row()
                      .text("Duran", `assign_worker:${item.id}:Duran`)
                      .text("Musa", `assign_worker:${item.id}:Musa`);

                    await bot.api.sendPhoto(marinaId, productImages[0]?.media || new InputFile(pdfViewBuffer), {
                      caption: `🧵 *Döşeme Görevlendirme*\n\nMüşteri: ${order.customerName}\nÜrün: ${item.product}\nMiktar: ${item.quantity}\n\n*İşi kime verelim?*`,
                      parse_mode: "Markdown",
                      reply_markup: keyboard
                    });
                  }
                  continue; // Döşeme için toplu PDF yerine tek tek butonlu gidiyoruz
                }

                // 2. KUMAŞ / DİKİŞHANE (Almira): Kumaş onay butonları
                if (currentDept === "Dikişhane" || currentDept === "Kumaş") {
                  for (const item of deptItems) {
                    // Toplam kumaş hesabı
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

                // 3. DİĞER DEPARTMANLAR (Standart Albüm Bildirimi)
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
              }
            } catch (distError) {
              logger.error({ err: distError, dept: currentDept }, "Dağıtım hatası");
            }
          }

          // 2. Marina Hanım'a Final Raporu
          const visualReport = orderService.generateVisualTable(order);
          try {
            await bot.api.sendMessage(marinaId, `🔔 *SAYIN MARİNA HANIM*\n\nSiparişler başarıyla tüm birimlere dağıtıldı.\n\n${visualReport}`, { parse_mode: "Markdown" });
            logger.info("✅ Marina Hanıma rapor gönderildi.");
          } catch (e) {
            logger.error({ err: e }, "❌ Marina raporu gönderilemedi.");
          }
        }
      } catch (error) {
        logger.error({ err: error }, "Gmail interval check error");
      }
    },
    60 * 1000,
  ); // 1 dakika (Test ve hızlı takip için)
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
bot.start();
