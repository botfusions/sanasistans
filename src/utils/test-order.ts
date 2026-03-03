import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { OrderService } from "./order.service";
import { XlsxUtils } from "./xlsx-utils";
import { Bot, InputFile } from "grammy";
import { StaffService } from "./staff.service";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
    console.error("❌ TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID eksik!");
    process.exit(1);
}

const bot = new Bot(token);
const orderService = new OrderService();
const staffService = new StaffService();

async function processOrderDistribution(order: any, emailImages: any[], excelRows?: any[]) {
    console.log(`🚀 Dağıtım fonksiyonu başladı. Sipariş No: ${order.orderNumber}, Ürün Sayısı: ${order.items?.length || 0}`);
    const departments = Array.from(new Set(order.items.map((i: any) => i.department).filter((d: any) => typeof d === 'string')));
    console.log(`📡 Bulunan Departmanlar: [${departments.join(", ")}]`);
    const customerName = order.customerName || "Belirtilmedi";

    for (const dept of departments) {
        console.log(`📂 İşleniyor: ${dept}`);
        const deptItems = order.items.filter((i: any) => i.department === dept);
        
        if (excelRows) {
            deptItems.forEach((item: any) => {
                const row = excelRows.find(r => r._rowNumber === item.rowIndex);
                if (row && row._imageBuffer) {
                    item.imageBuffer = row._imageBuffer;
                    item.imageExtension = row._imageExtension;
                }
            });
        }

        const deptMsg = orderService.generateDeptView(deptItems, customerName, dept as string);
        console.log(`📄 PDF üretiliyor: ${dept}`);
        const pdfBuffer = await orderService.generateJobOrderPDF(deptItems, customerName, dept as string);
        console.log(`✅ PDF üretildi: ${pdfBuffer.length} byte`);
        
        // PDF'DEN GÖRSEL GÖRÜNÜM (SCREENSHOT) ÜRET
        console.log(`🖼️ PDF View (Screenshot) üretiliyor...`);
        const pdfViewBuffer = await orderService.generatePDFView(pdfBuffer);
        console.log(`✅ PDF View üretildi: ${pdfViewBuffer.length} byte`);

        // YERELDE ARŞİVLE
        const pdfPath = await orderService.archivePDF(dept as string, pdfBuffer);
        console.log(`📂 PDF arşivlendi: ${pdfPath}`);
        
        const productImages = deptItems.filter((i: any) => i.imageBuffer).map((item: any, idx: number) => ({
            type: "photo" as const,
            media: new InputFile(item.imageBuffer, `product_${idx}.${item.imageExtension || 'jpg'}`)
        }));

        // TEST İÇİN: StaffService yerine doğrudan test ID'sini kullan
        const targetIds = [parseInt(process.env.TELEGRAM_CHAT_ID || "6030287709")];
        
        for (const targetId of targetIds) {
            if (!targetId) continue;
            
            console.log(`📡 [DEBUG] Bildirim denemesi: Departman=${dept}, TargetID=${targetId}`);
            
            try {
                // Görselleri tek bir listede birleştir (İş emri görünümü + Ürün görselleri)
                const media: any[] = [
                    {
                        type: "photo" as const,
                        media: new InputFile(pdfViewBuffer, `job_order_view.png`),
                        caption: deptMsg,
                        parse_mode: "Markdown" as const
                    },
                    ...productImages
                ];

                if (media.length > 1) {
                    console.log(`🖼️ [DEBUG] Albüm (Media Group) gönderiliyor (${media.length} görsel)...`);
                    await bot.api.sendMediaGroup(targetId, media);
                } else {
                    console.log(`📄 [DEBUG] Tek iş emri görseli gönderiliyor...`);
                    await bot.api.sendPhoto(targetId, media[0].media, {
                        caption: media[0].caption,
                        parse_mode: "Markdown"
                    });
                }

                console.log(`✅ [DEBUG] Görsel/Metin başarıyla gönderildi (Tek Bildirim)`);
            } catch (err: any) {
                console.error(`❌ [DEBUG] Telegram Gönderim Hatası (ID: ${targetId}):`, err.message || err);
            }
        }
    }
}

async function runTest() {
    try {
        const excelPath = path.resolve(process.cwd(), "docs", "SIPARIS FORMU-DENEME SIPARIS.xlsx");
        console.log("📂 Excel dosyası okunuyor...");
        const buffer = fs.readFileSync(excelPath);
        const excelRows = await XlsxUtils.parseExcel(excelPath); // buffer yerine yolu gönder
        
        // LLM'e sadece metin verisini gönderiyoruz
        const promptData = excelRows.map(r => {
            const copy = { ...r };
            delete copy._imageBuffer;
            return copy;
        });

        console.log("🧠 LLM Ayrıştırma başlatılıyor (Gerçek Akış)...");
        const order = await orderService.parseAndCreateOrder(
            JSON.stringify(promptData, null, 2),
            "DENEME SIPARIS FORMU",
            true,
            excelRows
        );

        if (!order) {
            console.error("❌ Sipariş ayrıştırılamadı!");
            return;
        }

        console.log(`✅ Sipariş Hazır: ${order.orderNumber}`);
        console.log(`📡 Ürün Sayısı: ${order.items.length}`);
        
        // Resim kontrolü
        const itemsWithImages = order.items.filter(i => i.imageBuffer);
        console.log(`🖼️ Resimli Ürün Sayısı: ${itemsWithImages.length}`);

        console.log("🚚 Dağıtım başlatılıyor...");
        await processOrderDistribution(order, [], excelRows);
        console.log("✨ Test tamamlandı!");
        
    } catch (error) {
        console.error("🔥 KRİTİK TEST HATASI:", error);
    }
}

runTest().catch(console.error);
