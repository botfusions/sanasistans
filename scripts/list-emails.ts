import { ImapFlow } from "imapflow";
import * as dotenv from "dotenv";

dotenv.config();

async function listRecentEmails() {
  const client = new ImapFlow({
    host: process.env.GMAIL_HOST || "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_PASS!,
    },
    logger: false,
  });

  await client.connect();
  let lock = await client.getMailboxLock("INBOX");
  try {
    let list = await client.fetch("1:*", { envelope: true }, { last: 10 });
    console.log("=== Last 10 Emails ===");
    for (let msg of list) {
      console.log(
        `UID: ${msg.uid} | Subject: ${msg.envelope.subject} | From: ${msg.envelope.from[0].address}`,
      );
    }
  } finally {
    lock.release();
  }
  await client.logout();
}

listRecentEmails().catch(console.error);
