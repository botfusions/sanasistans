import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

async function test() {
  const p1 = path.resolve("docs", "SIPARIS FORMU-DENEME SIPARIS.xlsx");

  console.log(`Test dosyasi: ${p1}`);
  let wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p1);

  console.log("Images on workbook:", wb.model?.media?.length || 0);

  if (wb.model && wb.model.media) {
    wb.model.media.forEach((m, i) => {
      console.log(`Media ${i}: name=${m.name}, type=${m.type}, ext=${m.extension}`);
    });
  }
}

test().catch(console.error);
