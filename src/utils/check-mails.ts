import { ImapFlow } from "imapflow";
import * as dotenv from "dotenv";

dotenv.config();

async function checkMails() {
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
      console.log("🔍 Tüm mesajlar listeleniyor...");
      for await (let msg of client.fetch("1:*", {
        flags: true,
        envelope: true,
        uid: true,
      })) {
        if (msg.uid === 24 || msg.uid === 69) {
          console.log(
            `[!] UID ${msg.uid}: [${Array.from(msg.flags || []).join(", ")}] ${msg.envelope?.subject} (Date: ${msg.envelope?.date})`,
          );
        } else if (msg.uid > 60) {
          console.log(
            `UID ${msg.uid}: [${Array.from(msg.flags || []).join(", ")}] ${msg.envelope?.subject}`,
          );
        }
      }

      console.log("\n🔍 { seen: false } araması...");
      const searchResult = await client.search({ seen: false });
      console.log("Arama Sonucu:", searchResult);
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error) {
    console.error("❌ Hata:", error);
  }
}

checkMails();
