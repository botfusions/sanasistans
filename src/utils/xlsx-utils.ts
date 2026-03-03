import * as ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import crypto from "crypto";

export interface ExcelRow {
  [key: string]: any;
  _rowNumber?: number;
  _imageBuffer?: Buffer;
  _imageExtension?: string;
}

export class XlsxUtils {
  /**
   * Excel içeriğini JSON dizisine çevirir ve resimleri ayıklar.
   */
  static async parseExcel(bufferOrPath: Buffer | string): Promise<ExcelRow[]> {
    const workbook = new ExcelJS.Workbook();
    let tempHandle: string | null = null;
    
    try {
      if (typeof bufferOrPath === 'string') {
        await workbook.xlsx.readFile(bufferOrPath);
      } else {
        // ExcelJS buffer üzerinden load edildiğinde resimleri bazen kaybedebilir.
        tempHandle = path.join(os.tmpdir(), `excel_temp_${crypto.randomBytes(8).toString('hex')}.xlsx`);
        fs.writeFileSync(tempHandle, bufferOrPath);
        await workbook.xlsx.readFile(tempHandle);
      }
    } catch (err) {
      console.error("❌ Excel okuma hatası:", err);
      if (tempHandle && fs.existsSync(tempHandle)) fs.unlinkSync(tempHandle);
      return [];
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      console.log("❌ Worksheet 1 bulunamadı!");
      if (tempHandle && fs.existsSync(tempHandle)) fs.unlinkSync(tempHandle);
      return [];
    }

    const rows: ExcelRow[] = [];

    // Tüm satırları ham veri olarak oku
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowData: ExcelRow = { _rowNumber: rowNumber };
      
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = cell.text ? cell.text.trim() : "";
        if (val) {
          rowData[`Col${colNumber}`] = val;
        }
      });
      
      // Sadece veri olan satırları ekle
      if (Object.keys(rowData).length > 1) {
        rows.push(rowData);
      }
    });

    // Resimleri işle
    const images: any[] = [];
    workbook.worksheets.forEach(ws => {
      const wsImages = ws.getImages();
      if (wsImages && wsImages.length > 0) {
        images.push(...wsImages);
      }
    });

    console.log(`🖼️ Toplam ${images.length} resim dosyadan okundu.`);

    const rowImageMap = new Map<number, { buffer: Buffer, extension: string, size: number, score: number }>();

    images.forEach((img) => {
      const excelImage = workbook.getImage(Number(img.imageId));
      if (!excelImage || !excelImage.buffer) return;

      const range = img.range;
      if (range && range.tl) {
        // tl.row 0-indexed, biz 1-indexed çalışıyoruz.
        const startRow = Math.floor(range.tl.row) + 1;
        const endRow = Math.floor(range.br.row) + 1;
        const startCol = Math.floor(range.tl.col); // 0-indexed column

        const imgBuffer = Buffer.from(excelImage.buffer as any);
        const imgSize = imgBuffer.length;
        
        // PUANLAMA MANTIĞI:
        // 1. Sütun 0 (A sütunu) içindeyse +100 puan (URUN FOTOSU sütunu)
        // 2. Sadece 1 satır kaplıyorsa +50 puan
        // 3. Aspect Ratio (En/Boy): Şekli kareye ne kadar yakınsa o kadar ürün resmidir. (0.5 - 1.5 arası +75 puan)
        // 4. Boyut: Çok büyük resimler (1MB+) genellikle screenshot'tır, bunlara ceza puanı ver (-50 puan)
        
        let score = 0;
        const width = range.br.col - range.tl.col;
        const height = range.br.row - range.tl.row;
        const aspectRatio = width / (height || 1);
        const isSquareish = aspectRatio > 0.4 && aspectRatio < 2.0;
        const isVeryLarge = imgSize > 1024 * 800; // 800KB üstü genellikle screenshot

        if (startCol === 0) score += 100;
        if (startRow === endRow) score += 50;
        if (isSquareish) score += 75;
        if (isVeryLarge) score -= 50;
        if (imgSize > 5120) score += 10; // 5KB'dan küçük ikonları ele

        // Resim hangi satıra ait?
        const targetRowNumber = startRow;
        
        const existing = rowImageMap.get(targetRowNumber);
        // Puanı yüksek olanı seç, puan eşitse BOYUTU KÜÇÜK olanı seç (screenshot'a karşı ürün fotosunu koru)
        if (!existing || score > existing.score || (score === existing.score && imgSize < existing.size)) {
          rowImageMap.set(targetRowNumber, {
            buffer: imgBuffer,
            extension: excelImage.extension || "png",
            size: imgSize,
            score: score
          });
        }
      }
    });

    // Bulunan resimleri satırlara ata
    rows.forEach(row => {
      if (row._rowNumber && rowImageMap.has(row._rowNumber)) {
        const imgData = rowImageMap.get(row._rowNumber)!;
        row._imageBuffer = imgData.buffer;
        row._imageExtension = imgData.extension;
        console.log(`✅ Satır ${row._rowNumber} için resim atandı (${Math.round(imgData.size / 1024)} KB, Skor: ${imgData.score})`);
      }
    });

    if (tempHandle && fs.existsSync(tempHandle)) fs.unlinkSync(tempHandle);
    
    // Eğer sayfada anchor edilen hiç resim yoksa, ancak arka planda (media) resimler mevcutsa
    // Bunları serbest resimler olarak diziye ekle
    if (images.length === 0 && workbook.model?.media?.length) {
      const floatingImages = workbook.model.media
        .filter((m: any) => m.type === 'image' && m.buffer)
        .map((m: any) => m.buffer);
      
      if (floatingImages.length > 0) {
        console.log(`🖼️ [INFO] Anchor edilememiş ${floatingImages.length} adet serbest resim bulundu, sonradan eşleştirilecek.`);
        (rows as any).floatingImages = floatingImages;
      }
    }

    return rows;
  }

  /**
   * JSON verisini okunabilir bir string tabloya çevirir.
   */
  static formatToTable(data: ExcelRow[]): string {
    if (data.length === 0) return "Veri bulunamadı.";

    const headers = Object.keys(data[0]).filter(h => !h.startsWith("_"));
    let table = headers.join(" | ") + "\n";
    table += headers.map(() => "---").join(" | ") + "\n";

    data.forEach((row) => {
      table += headers.map((h) => (row[h] !== undefined && row[h] !== null ? String(row[h]) : "-")).join(" | ") + "\n";
    });

    return table;
  }
}
