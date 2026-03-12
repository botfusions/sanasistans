import { createClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_PASS = (process.env.GMAIL_PASS || "").replace(/\s/g, "");

async function fullCleanup() {
  console.log("🚀 Full Cleanup Started...");

  // 1. Reset IMAP Flag
  console.log("\n📧 1. Resetting IMAP flag for UID 69...");
  const imapClient = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  try {
    await imapClient.connect();
    const lock = await imapClient.getMailboxLock("INBOX");
    try {
      // Çöp kutusuna taşı (Gmail için en güvenli silme yolu)
      const targetUids = ["69", "71"];
      for (const uid of targetUids) {
        try {
          await imapClient.messageMove(uid, "[Gmail]/Çöp Kutusu", {
            uid: true,
          });
          console.log(`✅ Message UID ${uid} moved to Trash.`);
        } catch (_moveErr) {
          // Eğer klasör adı farklıysa (İngilizce ise) tekrar dene
          try {
            await imapClient.messageMove(uid, "[Gmail]/Trash", { uid: true });
            console.log(
              `✅ Message UID ${uid} moved to Trash (English folder).`,
            );
          } catch (retryErr) {
            console.warn(`⚠️ Could not move UID ${uid} to Trash:`, retryErr);
          }
        }
      }
    } finally {
      lock.release();
    }
    await imapClient.logout();
  } catch (err) {
    console.error("❌ IMAP Cleanup Error:", err);
  }
  // 1.5 Clear Local Files
  console.log("\n🧹 1.5. Clearing Local Files...");
  try {
    fs.writeFileSync(
      path.join(process.cwd(), "data", "processed_uids.json"),
      "[]",
    );
    console.log("✅ processed_uids.json cleared.");
    const logPath = path.join(process.cwd(), "data", "verilen_siparisler.log");
    if (fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, "");
      console.log("✅ verilen_siparisler.log cleared.");
    }
  } catch (err) {
    console.error("❌ Failed to clear local files:", err);
  }
  // 2. Clear Supabase Tables
  console.log("\ndb 2. Clearing Supabase tables...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Delete items first (foreign keys)
    const { error: itemError } = await supabase
      .from("order_items")
      .delete()
      .neq("id", "0");
    if (itemError) throw itemError;
    console.log("✅ order_items cleared.");

    const { error: memoryError } = await supabase
      .from("visual_memory")
      .delete()
      .neq("id", "0");
    if (memoryError) throw memoryError;
    console.log("✅ visual_memory cleared.");

    const { error: orderError } = await supabase
      .from("orders")
      .delete()
      .neq("id", "0");
    if (orderError) throw orderError;
    console.log("✅ orders cleared.");
  } catch (err) {
    console.error("❌ Supabase Cleanup Error:", err);
  }

  console.log("\n✨ Cleanup Complete!");
}

fullCleanup();
