import { createClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import OpenAI from "openai";
import pino from "pino";
import dotenv from "dotenv";

dotenv.config();
const logger = pino({ name: "DoctorService" });

export interface DiagnosticResult {
  service: string;
  status: "OK" | "ERROR" | "WARNING";
  message: string;
  remedy?: string;
}

export class DoctorService {
  private supabaseUrl: string;
  private supabaseKey: string;
  private openai: OpenAI;

  constructor() {
    // SSL bypass
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    this.supabaseUrl = process.env.SUPABASE_URL || "";
    this.supabaseKey = process.env.SUPABASE_KEY || "";
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }

  public async checkVectorMemory(): Promise<DiagnosticResult> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      return {
        service: "Vector Memory (pgvector)",
        status: "WARNING",
        message: "Supabase kimlik bilgileri eksik, vektör kontrolü yapılamadı.",
      };
    }
    const supabase = createClient(this.supabaseUrl, this.supabaseKey);
    try {
      const { error } = await supabase
        .from("visual_memory")
        .select("id")
        .limit(1);
      if (error) {
        if (error.message.includes("does not exist")) {
          return {
            service: "Vector Memory (pgvector)",
            status: "ERROR",
            message: "Hata: visual_memory tablosu bulunamadı.",
            remedy:
              "Supabase SQL Editor üzerinden visual_memory tablosunu oluşturun.",
          };
        }
        throw error;
      }
      return {
        service: "Vector Memory (pgvector)",
        status: "OK",
        message: "Bağlantı başarılı ve pgvector tablosu aktif.",
      };
    } catch (error: any) {
      return {
        service: "Vector Memory (pgvector)",
        status: "ERROR",
        message: `Hata: ${error.message}`,
        remedy: "Supabase ve pgvector eklentisi ayarlarını kontrol edin.",
      };
    }
  }

  public async checkSupabase(): Promise<DiagnosticResult> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      return {
        service: "Supabase",
        status: "WARNING",
        message: "Kimlik bilgileri eksik.",
      };
    }
    const supabase = createClient(this.supabaseUrl, this.supabaseKey);
    try {
      const { error } = await supabase.from("orders").select("id").limit(1);
      if (error) throw error;
      return {
        service: "Supabase",
        status: "OK",
        message: `Bağlantı OK. Proje: ${this.supabaseUrl.split("//")[1].split(".")[0]}`,
      };
    } catch (error: any) {
      return {
        service: "Supabase",
        status: "ERROR",
        message: `Sorgu hatası: ${error.message}`,
        remedy: "Supabase ayarlarını kontrol edin.",
      };
    }
  }

  public async checkLLM(): Promise<DiagnosticResult> {
    try {
      await this.openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      });
      return {
        service: "LLM (OpenRouter)",
        status: "OK",
        message: "Bağlantı başarılı.",
      };
    } catch (error: any) {
      return {
        service: "LLM (OpenRouter)",
        status: "ERROR",
        message: error.message,
      };
    }
  }

  public async checkGmail(): Promise<DiagnosticResult> {
    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER || "",
        pass: process.env.GMAIL_PASS || "",
      },
      tls: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      await client.logout();
      return {
        service: "Gmail (IMAP)",
        status: "OK",
        message: "Giriş başarılı.",
      };
    } catch (error: any) {
      return {
        service: "Gmail (IMAP)",
        status: "ERROR",
        message: error.message,
      };
    }
  }

  /**
   * TCP socket ile portu test eder — HTTP'ye gerek yok, salt bağlantı kontrolü.
   */
  private testTcpPort(
    host: string,
    port: number,
    timeoutMs = 5000,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const net = require("net");
      const start = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);
      socket.connect(port, host, () => {
        const elapsed = Date.now() - start;
        socket.destroy();
        resolve(elapsed);
      });
      socket.on("error", (err: Error) => {
        socket.destroy();
        reject(err);
      });
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Timeout"));
      });
    });
  }

  public async checkNetwork(): Promise<DiagnosticResult> {
    const LATENCY_THRESHOLD = 300;
    // Kritik mail portları — sistem bunlar olmadan çalışmaz
    const mailTargets = [
      { host: "smtp.gmail.com", port: 587, label: "Gmail SMTP" },
      { host: "imap.gmail.com", port: 993, label: "Gmail IMAP" },
    ];

    // Altyapı ve Genel İnternet kontrolleri
    const infraTargets = [
      {
        host: "aejhzxvuegchakaknwts.supabase.co",
        port: 443,
        label: "Supabase",
      },
      { host: "google.com", port: 443, label: "Google (Internet)" },
    ];

    let report = "Ağ Tarama Sonuçları:\n";
    let hasNetworkError = false;

    // Mail Port Kontrolleri (TCP)
    for (const target of mailTargets) {
      try {
        const elapsed = await this.testTcpPort(target.host, target.port);
        const warning = elapsed > LATENCY_THRESHOLD ? " ⚠️ Yüksek gecikme" : "";
        report += `✅ ${target.label} -> ERİŞİLEBİLİR (${elapsed}ms)${warning}\n`;
      } catch (e: any) {
        hasNetworkError = true;
        report += `❌ ${target.label} -> HATA: ${e.message}\n`;
      }
    }

    // Altyapı Kontrolleri (HTTPS fetch)
    for (const target of infraTargets) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const protocol = "https";

        await fetch(`${protocol}://${target.host}`, {
          method: "HEAD",
          signal: controller.signal,
          // @ts-ignore
          agent: new (require("https").Agent)({ rejectUnauthorized: false }),
        }).catch((fetchErr: any) => {
          // Re-throw only real network errors; HTTP-level errors (4xx, 3xx) mean server is reachable
          const isNetworkError =
            fetchErr.name === "AbortError" ||
            fetchErr.message?.includes("ENOTFOUND") ||
            fetchErr.message?.includes("ECONNREFUSED") ||
            fetchErr.message?.includes("ETIMEDOUT");
          if (isNetworkError) throw fetchErr;
          // Otherwise swallow — server answered even if with an error code
        });

        clearTimeout(timeoutId);
        const elapsed = Date.now() - start;
        const warning = elapsed > LATENCY_THRESHOLD ? " ⚠️ Yüksek gecikme" : "";
        report += `✅ ${target.label} -> ERİŞİLEBİLİR (${elapsed}ms)${warning}\n`;
      } catch (e: any) {
        hasNetworkError = true;
        const msg = e.name === "AbortError" ? "Timeout (5s)" : e.message;
        report += `❌ ${target.label} -> HATA: ${msg}\n`;
      }
    }

    return {
      service: "Network Scanner",
      status: hasNetworkError ? "WARNING" : "OK",
      message: report,
    };
  }

  public async runFullDiagnostics(): Promise<DiagnosticResult[]> {
    return [
      await this.checkVectorMemory(),
      await this.checkNetwork(),
      await this.checkSupabase(),
      await this.checkLLM(),
      await this.checkGmail(),
    ];
  }

  public async checkSystem(): Promise<string> {
    const results = await this.runFullDiagnostics();
    return this.formatReport(results);
  }

  public formatReport(results: DiagnosticResult[]): string {
    const escape = (str: string) =>
      str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let report = "<b>🩺 SİSTEM SAĞLIK RAPORU (DOCTOR)</b>\n\n";
    results.forEach((res) => {
      const icon =
        res.status === "OK" ? "✅" : res.status === "WARNING" ? "⚠️" : "❌";
      report += `${icon} <b>${escape(res.service)}</b>: ${res.status}\n`;
      report += `📝 <i>${escape(res.message)}</i>\n`;
      if (res.remedy) report += `💡 <b>Çözüm:</b> ${escape(res.remedy)}\n`;
      report += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
    });
    const errors = results.filter((r) => r.status === "ERROR").length;
    report +=
      errors === 0
        ? "\n🚀 <b>Sistem stabil.</b>"
        : `\n⚠️ <b>${errors} hata bulundu.</b>`;
    return report;
  }
}
