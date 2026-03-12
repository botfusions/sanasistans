import { ImapFlow } from "imapflow";
import * as dotenv from "dotenv";

dotenv.config();

async function resetMailFlags(uid: string) {
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
      console.log(`🔍 UID ${uid} için mevcut bayraklar kontrol ediliyor...`);
      let msg = await client.fetchOne(uid, { flags: true }, { uid: true });
      if (msg) {
        console.log(
          `Mevcut Bayraklar: [${Array.from(msg.flags || []).join(", ")}]`,
        );

        console.log(`🧹 \\Seen bayrağı kaldırılıyor...`);
        await client.messageFlagsRemove(uid, ["\\Seen"], { uid: true });

        console.log(`✔️ Kontrol ediliyor...`);
        let updatedMsg = await client.fetchOne(
          uid,
          { flags: true },
          { uid: true },
        );
        if (updatedMsg) {
          console.log(
            `Güncel Bayraklar: [${Array.from(updatedMsg.flags || []).join(", ")}]`,
          );
          const isSeen = updatedMsg.flags
            ? updatedMsg.flags.has("\\Seen")
            : false;
          if (!isSeen) {
            console.log(
              `✅ Mesaj ${uid} başarıyla OKUNMADI olarak işaretlendi.`,
            );
          } else {
            console.log(`❌ HATA: \\Seen bayrağı hala duruyor!`);
          }
        }
      } else {
        console.log(`❌ HATA: UID ${uid} bulunamadı.`);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error) {
    console.error("❌ Hata:", error);
  }
}

resetMailFlags("69");
