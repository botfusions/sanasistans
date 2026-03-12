import { GmailService } from "../src/utils/gmail.service";
import * as dotenv from "dotenv";
dotenv.config();

async function checkLastMessages() {
  const gmail = GmailService.getInstance();
  // @ts-ignore - access private
  const client = (gmail as any).client;
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  const searchResult = await client.search({}, { uid: true });
  console.log("Total messages:", searchResult.length);
  console.log("Last 5 UIDs:", searchResult.slice(-5));
  lock.release();
  await client.logout();
}

checkLastMessages().catch(console.error);
