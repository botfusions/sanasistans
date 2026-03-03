import * as dotenv from "dotenv";
dotenv.config();
import { ImapFlow } from "imapflow";

async function testConnection() {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER || "",
      pass: process.env.GMAIL_PASS || "",
    },
    logger: false,
  });

  try {
    await client.connect();
    console.log("✅ IMAP Connection Successful");
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { unseen: true, messages: true });
      console.log("Inbox Status:", status);
      
      const searchResult = await client.search({ seen: false });
      console.log("Unread Message UIDs:", searchResult);
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error) {
    console.error("❌ Connection failed:", error);
  }
}

testConnection();
