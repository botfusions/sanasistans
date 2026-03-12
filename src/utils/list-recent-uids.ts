import { ImapFlow } from "imapflow";
import * as dotenv from "dotenv";

dotenv.config();

async function listRecentUids() {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER || "",
      pass: (process.env.GMAIL_PASS || "").replace(/\s/g, ""),
    },
    logger: false,
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      console.log("🔍 Son 20 mesaj listeleniyor...");
      // Fetch the total number of messages first
      const status = await client.status("INBOX", { messages: true });
      const total = status.messages || 0;
      const start = Math.max(1, total - 20);

      const messages = await client.fetch(`${start}:*`, {
        envelope: true,
        uid: true,
        flags: true,
      });

      for await (let msg of messages) {
        console.log(
          `UID: ${msg.uid} | Subject: ${msg.envelope?.subject} | Date: ${msg.envelope?.date} | Flags: ${Array.from(msg.flags || []).join(", ")}`,
        );
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error) {
    console.error("❌ Hata:", error);
  }
}

listRecentUids();
