import ExcelJS from 'exceljs';
import path from 'path';

async function test() {
  const p1 = path.resolve("docs", "SIPARIS FORMU-DENEME SIPARIS.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p1);

  const ws = wb.worksheets[0];
  console.log("ws.getImages():", ws.getImages().length);
  // attempt to read private/internal drawing properties
  const drawings = (ws as any)._media || (ws as any).drawing || (ws as any).drawings || [];
  console.log("Drawings:", drawings.length ? drawings : "None");
}

test().catch(console.error);
