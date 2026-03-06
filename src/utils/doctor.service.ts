import { QdrantClient } from "@qdrant/js-client-rest";
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
  private qdrantClient: QdrantClient;
  private supabaseUrl: string;
  private supabaseKey: string;
  private openai: OpenAI;

  constructor() {
    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY,
      checkCompatibility: false,
    });
    this.supabaseUrl = process.env.SUPABASE_URL || "";
    this.supabaseKey = process.env.SUPABASE_KEY || "";
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }

  public async checkQdrant(): Promise<DiagnosticResult> {
    const url = process.env.QDRANT_URL || "http://localhost:6333";
    try {
      await this.qdrantClient.getCollections();
      return {
        service: "Qdrant",
        status: "OK",
        message: `Bağlantı başarılı. (URL: ${url})`
      };
    } catch (error: any) {
      let remedy = "QDRANT_URL ve QDRANT_API_KEY değişkenlerini kontrol edin.";
      const errorMsg = error.message || "Bilinmeyen hata";
      
      if (errorMsg.includes("fetch failed")) {
        remedy = "Ağ Bağlantı Hatası! Domain yerine IP (http://5.182.33.26:6333) veya Coolify servis adını (http://qdrant:6333) deneyin.";
      } else if (errorMsg.includes("cert") || errorMsg.includes("SSL")) {
        remedy = "SSL/Sertifika Hatası! NODE_TLS_REJECT_UNAUTHORIZED=0 olduğundan emin olun veya HTTP üzerinden bağlanmayı deneyin.";
      }
      
      return {
        service: "Qdrant",
        status: "ERROR",
        message: `Hata: ${errorMsg} (URL: ${url})`,
        remedy
      };
    }
  }

  public async checkSupabase(): Promise<DiagnosticResult> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      return { service: "Supabase", status: "WARNING", message: "Kimlik bilgileri eksik." };
    }
    const supabase = createClient(this.supabaseUrl, this.supabaseKey);
    try {
      const { error } = await supabase.from("orders").select("id").limit(1);
      if (error) throw error;
      return {
        service: "Supabase",
        status: "OK",
        message: `Bağlantı OK. Proje: ${this.supabaseUrl.split('//')[1].split('.')[0]}`
      };
    } catch (error: any) {
      return {
        service: "Supabase",
        status: "ERROR",
        message: `Sorgu hatası: ${error.message}`,
        remedy: "SQL repair scriptini çalıştırdığınızdan ve Project Ref'in doğru olduğundan emin olun."
      };
    }
  }

  public async checkLLM(): Promise<DiagnosticResult> {
    try {
      await this.openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5
      });
      return { service: "LLM (OpenRouter)", status: "OK", message: "Bağlantı başarılı." };
    } catch (error: any) {
      return { service: "LLM (OpenRouter)", status: "ERROR", message: error.message };
    }
  }

  public async checkGmail(): Promise<DiagnosticResult> {
    const client = new ImapFlow({
      host: "imap.gmail.com", port: 993, secure: true,
      auth: { user: process.env.GMAIL_USER || "", pass: process.env.GMAIL_PASS || "" },
      tls: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      await client.logout();
      return { service: "Gmail (IMAP)", status: "OK", message: "Giriş başarılı." };
    } catch (error: any) {
      return { service: "Gmail (IMAP)", status: "ERROR", message: error.message };
    }
  }

  public async runFullDiagnostics(): Promise<DiagnosticResult[]> {
    return [
      await this.checkQdrant(),
      await this.checkSupabase(),
      await this.checkLLM(),
      await this.checkGmail()
    ];
  }

  public formatReport(results: DiagnosticResult[]): string {
    const escape = (str: string) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let report = "<b>🩺 SİSTEM SAĞLIK RAPORU (DOCTOR)</b>\n\n";
    results.forEach(res => {
      const icon = res.status === "OK" ? "✅" : res.status === "WARNING" ? "⚠️" : "❌";
      report += `${icon} <b>${escape(res.service)}</b>: ${res.status}\n`;
      report += `📝 <i>${escape(res.message)}</i>\n`;
      if (res.remedy) report += `💡 <b>Çözüm:</b> ${escape(res.remedy)}\n`;
      report += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
    });
    const errors = results.filter(r => r.status === "ERROR").length;
    report += errors === 0 ? "\n🚀 <b>Sistem stabil.</b>" : `\n⚠️ <b>${errors} hata bulundu.</b>`;
    return report;
  }
}
