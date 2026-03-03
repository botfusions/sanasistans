import * as dotenv from "dotenv";
dotenv.config();
import { GmailService } from "./src/utils/gmail.service";
import { OrderService } from "./src/utils/order.service";
import { XlsxUtils } from "./src/utils/xlsx-utils";
import { simpleParser } from "mailparser";

async function debugLastEmail() {
  const gmail = GmailService.getInstance();
  const orderService = new OrderService();
  const client = (gmail as any).client;
  
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const searchResult = await client.search({ all: true });
    const lastUid = searchResult[searchResult.length - 1];
    console.log("Reading Message UID:", lastUid);
    
    const raw = await client.fetchOne(lastUid.toString(), { source: true });
    const parsed = await simpleParser(raw.source);
    
    console.log("Subject:", parsed.subject);
    console.log("From:", parsed.from?.text);
    
    const attachments = (parsed.attachments || []).map(attr => ({
      filename: attr.filename || "unnamed",
      contentType: attr.contentType,
      content: attr.content
    }));

    console.log("Attachments count:", attachments.length);
    
    let excelProcessed = false;
    for (const attr of attachments) {
      console.log("Checking attachment:", attr.filename);
      if (attr.filename.toLowerCase().endsWith(".xlsx") || attr.filename.toLowerCase().endsWith(".xls")) {
        console.log("Excel detected. Parsing...");
        const data = XlsxUtils.parseExcel(attr.content);
        console.log("Rows found:", data.length);
        const contentString = JSON.stringify(data, null, 2);
        
        console.log("Calling LLM...");
        const order = await orderService.parseAndCreateOrder(contentString, parsed.subject || "", true);
        if (order) {
          console.log("Order parsed successfully!");
          console.log(orderService.getVisualSummary(order));
          excelProcessed = true;
        } else {
          console.log("Order parsing failed (LLM returned null).");
        }
      }
    }

    if (!excelProcessed && parsed.text) {
      console.log("No excel processed, parsing text body...");
      const order = await orderService.parseAndCreateOrder(parsed.text, parsed.subject || "");
      if (order) {
        console.log("Order parsed from text!");
        console.log(orderService.getVisualSummary(order));
      }
    }

  } finally {
    lock.release();
  }
  await client.logout();
}

debugLastEmail().catch(console.error);
