import * as fs from 'fs';
import * as path from 'path';

const dumpPath = path.join(process.cwd(), "data", "tests", "excel_dump.json");
const data = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

console.log(`Toplam Satır: ${data.length}`);

const products = data.filter((row: any) => {
  // Satır 8 başlıklardı. Başlıklardan sonrasına bakalım.
  if (row._rowNumber <= 8) return false;
  
  // Bir satırın ürün olması için KOD (Col2) veya URUN ADI (Col3) dolu olmalı
  // Veya resim içermeli
  return (row.Col2 || row.Col3 || row._imageBuffer);
});

console.log(`Ürün olarak değerlendirilen satır sayısı: ${products.length}`);
products.forEach((p: any) => {
  console.log(`Satır ${p._rowNumber}: KOD=${p.Col2}, AD=${p.Col3}, RESIM=${p._imageBuffer ? 'VAR' : 'YOK'}`);
});
