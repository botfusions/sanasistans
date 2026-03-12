import { ImapFlow, FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import * as nodemailer from "nodemailer";
import { pino } from "pino";

const logger = pino();

export interface GmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface GmailMessage {
  uid: number;
  from: string;
  subject: string;
  date: Date;
  content?: string;
  source?: Buffer;
  attachments?: GmailAttachment[];
}

export class GmailService {
  private static instance: GmailService;
  private client: ImapFlow;
  private transporter: nodemailer.Transporter;

  private constructor() {
    this.client = new ImapFlow({
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

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER || "",
        pass: (process.env.GMAIL_PASS || "").replace(/\s/g, ""),
      },
    });
  }

  public static getInstance(): GmailService {
    if (!GmailService.instance) {
      GmailService.instance = new GmailService();
    }
    return GmailService.instance;
  }

  /**
   * E-posta gönderir.
   */
  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject,
        text,
        html,
      });
      logger.info(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      logger.error({ err: error }, `Failed to send email to ${to}`);
      return false;
    }
  }

  /**
   * Okunmamış son mesajları getirir ve işler, ardından okundu olarak işaretler.
   */
  async processUnreadMessages(
    limit: number = 5,
    processor: (msg: GmailMessage) => Promise<void>,
  ): Promise<void> {
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
        logger.info("📡 IMAP: INBOX aranıyor (seen: false)...");
        const searchResult = await client.search({}, { uid: true });
        logger.info({ searchResult }, `🔍 IMAP Arama Sonucu`);
        const count = Array.isArray(searchResult) ? searchResult.length : 0;
        logger.info(`🔍 IMAP: ${count} adet okunmamış mesaj bulundu.`);

        if (Array.isArray(searchResult) && searchResult.length > 0) {
          const lastIds = searchResult.slice(-limit).reverse();

          for (const uid of lastIds) {
            logger.info(`📧 Mesaj UID ${uid} getiriliyor...`);
            const raw = (await client.fetchOne(
              uid.toString(),
              {
                source: true,
              },
              { uid: true },
            )) as FetchMessageObject;

            if (raw && raw.source) {
              const parsed = await simpleParser(raw.source);

              const attachments: GmailAttachment[] = (
                parsed.attachments || []
              ).map((attr) => ({
                filename: attr.filename || "unnamed",
                contentType: attr.contentType,
                content: attr.content,
              }));

              let content = parsed.text || "";
              if (!content && parsed.html) {
                logger.info(
                  `📝 UID ${uid} metin içeriği yok, HTML fallback kullanılıyor.`,
                );
                content = parsed.html.replace(/<[^>]*>?/gm, " "); // Simple HTML to text
              }

              const msg: GmailMessage = {
                uid: uid,
                from: parsed.from?.text || "Unknown",
                subject: parsed.subject || "(Konu Yok)",
                date: parsed.date || new Date(),
                content: content,
                attachments: attachments,
              };

              logger.info(
                `📦 UID ${uid} işlenmeye hazır. Konu: ${msg.subject}`,
              );

              try {
                // İşlemi yap
                await processor(msg);
              } catch (procError) {
                logger.error(
                  { err: procError },
                  `Error while processing email ${uid}`,
                );
              } finally {
                // Başarıyla işlense de hata alsa da okundu olarak işaretle (sonsuz döngüyü önler)
                try {
                  await client.messageFlagsAdd(uid.toString(), ["\\Seen"], {
                    uid: true,
                  });
                  logger.info(`Message ${uid} marked as read.`);
                } catch (flagError) {
                  logger.error(
                    { err: flagError },
                    `Failed to mark message ${uid} as read`,
                  );
                }
              }
            }
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (error) {
      logger.error({ err: error }, "Gmail IMAP error during processing");
    }
  }

  async fetchOneMessage(uid: number): Promise<GmailMessage | null> {
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
        const raw = (await client.fetchOne(
          uid.toString(),
          {
            source: true,
          },
          { uid: true },
        )) as FetchMessageObject;

        if (raw && raw.source) {
          const parsed = await simpleParser(raw.source);

          const attachments: GmailAttachment[] = (parsed.attachments || []).map(
            (attr) => ({
              filename: attr.filename || "unnamed",
              contentType: attr.contentType,
              content: attr.content,
            }),
          );

          let content = parsed.text || "";
          if (!content && parsed.html) {
            // Fallback to HTML if text is empty (common in forwarded emails)
            content = parsed.html.replace(/<[^>]*>?/gm, " "); // Simple HTML to text
          }

          return {
            uid: uid,
            from: parsed.from?.text || "Unknown",
            subject: parsed.subject || "(Konu Yok)",
            date: parsed.date || new Date(),
            content: content,
            source: raw.source,
            attachments: attachments,
          };
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      logger.error({ err }, `Error fetching message ${uid}`);
    } finally {
      await client.logout();
    }
    return null;
  }
}
