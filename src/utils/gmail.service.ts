import { ImapFlow, FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import * as nodemailer from "nodemailer";
import { pino } from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});

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
        pass: process.env.GMAIL_PASS || "",
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER || "",
        pass: process.env.GMAIL_PASS || "",
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
  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
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
        pass: process.env.GMAIL_PASS || "",
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        const searchResult = await client.search({ seen: false });

        if (searchResult && searchResult.length > 0) {
          const lastIds = searchResult.slice(-limit).reverse();

          for (const uid of lastIds) {
            const raw = (await client.fetchOne(uid.toString(), {
              source: true,
            })) as FetchMessageObject;

            if (raw && raw.source) {
              const parsed = await simpleParser(raw.source);

              const attachments: GmailAttachment[] = (
                parsed.attachments || []
              ).map((attr) => ({
                filename: attr.filename || "unnamed",
                contentType: attr.contentType,
                content: attr.content,
              }));

              const msg: GmailMessage = {
                uid: uid,
                from: parsed.from?.text || "Unknown",
                subject: parsed.subject || "(Konu Yok)",
                date: parsed.date || new Date(),
                content: parsed.text || "",
                attachments: attachments,
              };

              try {
                // İşlemi yap
                await processor(msg);
              } catch (procError) {
                logger.error({ err: procError }, `Error while processing email ${uid}`);
              } finally {
                // Başarıyla işlense de hata alsa da okundu olarak işaretle (sonsuz döngüyü önler)
                try {
                  await client.messageFlagsAdd(uid.toString(), ["\\Seen"]);
                  logger.info(`Message ${uid} marked as read.`);
                } catch (flagError) {
                  logger.error({ err: flagError }, `Failed to mark message ${uid} as read`);
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
}
