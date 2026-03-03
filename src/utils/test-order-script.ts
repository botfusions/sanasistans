import { Bot, InputFile } from "grammy";
import http from "http";
import * as dotenv from "dotenv";
import { MessageHandler } from "../handlers/message.handler";
import { CommandHandler } from "../handlers/command.handler";
import { CronService } from "./cron.service";
import { GmailService } from "./gmail.service";
import { OrderService } from "./order.service";
import { StaffService } from "./staff.service";
import { XlsxUtils } from "./xlsx-utils";
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
          // Marina Hanım Telegram ID
          const marinaId = allowlist[0];
          
          // 1. Departmanlara Özel Gönderim
          const departments = Array.from(new Set(order.items.map((i: any) => i.department)));
          const customerName = OrderService.escapeMarkdown(order.customerName as string);

          for (const dept of departments) {
            const deptItems = order.items.filter((i: any) => i.department === dept);
            const escapedDept = OrderService.escapeMarkdown(dept as string);

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

            const deptMsg = orderService.generateDeptView(deptItems, order.customerName as string, dept as string);

            // --- PDF İŞ EMRI OLUŞTURMA ---
            try {
              const currentDept = dept as string;
              
              // Bu departmana ait tüm resimli ürünleri topla
              const itemsWithImages = deptItems.filter((i: any) => i.imageBuffer);
              
              const pdfBuffer = await orderService.generateJobOrderPDF(deptItems, (order.customerName as string) || "Belirtilmedi", currentDept);
              const pdfFile = new InputFile(pdfBuffer, `is_emri_${currentDept.replace(/\s+/g, '_')}.pdf`);
              
              // Mesaj Gönderim Mantığı
              try {
                const staffMembers = staffService.getStaffByDepartment(currentDept);
                const targetIds = staffMembers.length > 0 ? staffMembers.map((s: any) => s.telegramId).filter((id: any) => !!id) : [chatId];

                for (const targetId of targetIds) {
                  if (!targetId) continue;
                  
                  if (itemsWithImages.length > 1) {
                    // Birden fazla resim varsa Media Group (Album) olarak gönder
                    const media = itemsWithImages.map((item: any, idx: number) => ({
                      type: "photo" as const,
                      media: new InputFile(item.imageBuffer, `product_${idx}.${item.imageExtension || 'jpg'}`),
                      caption: idx === 0 ? deptMsg : undefined,
                      parse_mode: "Markdown" as const
                    }));
                    await bot.api.sendMediaGroup(targetId, media);
                  } else if (itemsWithImages.length === 1) {
                    // Tek resim varsa sendPhoto
                    const item = itemsWithImages[0];
                    await bot.api.sendPhoto(targetId, new InputFile(item.imageBuffer, `product.${item.imageExtension || 'jpg'}`), { 
                      caption: deptMsg, 
                      parse_mode: "Markdown" 
                    });
                  } else if (emailImages.length > 0) {
                    // Ürünle eşleşen resim yok ama e-postada resim var
                    await bot.api.sendPhoto(targetId, new InputFile(emailImages[0].buffer, emailImages[0].filename), { 
                      caption: deptMsg, 
                      parse_mode: "Markdown" 
                    });
                  } else {
                    // Hiç resim yok
                    await bot.api.sendMessage(targetId, deptMsg, { parse_mode: "Markdown" });
                  }

                  // PDF Belgesini her durumda gönder (Resmi Belge)
                  await bot.api.sendDocument(targetId, pdfFile, { 
                    caption: `📄 *${escapedDept}* Resmi İş Emri Belgesi`, 
                    parse_mode: "Markdown" 
                  });
                }
                logger.info(`📄 PDF İş Emri ve Görseller gönderildi: ${currentDept} (Alıcı Sayısı: ${targetIds.length})`);
              } catch (sendError: any) {
                logger.error({ err: sendError, department: currentDept }, "❌ Mesaj/PDF gönderim hatası");
              }
            } catch (pdfError: any) {
              logger.error({ err: pdfError, department: dept }, "❌ PDF oluşturma hatası");
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
