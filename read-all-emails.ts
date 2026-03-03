import { GmailService } from './src/utils/gmail.service';
import { simpleParser } from "mailparser";
import * as dotenv from "dotenv";
dotenv.config();

async function checkEmails() {
  const gmail = GmailService.getInstance();
  const client = (gmail as any).client;
  
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const searchResult = await client.search({ uid: true }); // get all
    const lastIds = searchResult.slice(-3).reverse();
    
    for (const uid of lastIds) {
      const msgRaw = await client.fetchOne(uid.toString(), { source: true });
      if (msgRaw && msgRaw.source) {
        const parsed = await simpleParser(msgRaw.source);
        console.log(`Email UID: ${uid}`);
        console.log(`Subject: ${parsed.subject}`);
        console.log(`From: ${parsed.from?.text}`);
        console.log(`Attachments length: ${parsed.attachments?.length || 0}`);
        if (parsed.attachments) {
            for (const att of parsed.attachments) {
                console.log(` - ${att.filename} (${att.contentType})`);
            }
        }
        console.log("-----------------------");
      }
    }
  } finally {
    lock.release();
  }
  await client.logout();
}

checkEmails().catch(console.error);
