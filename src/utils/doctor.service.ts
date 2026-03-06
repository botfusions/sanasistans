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
    try {
      await this.qdrantClient.getCollections();
      return {
        service: "Qdrant",
        status: "OK",
        message: "Bağlantı başarılı, koleksiyonlar erişilebilir."
      };
    } catch (error: any) {
      let remedy = "QDRANT_URL ve QDRANT_API_KEY değişkenlerini kontrol edin. Docker container'ın çalıştığından emin olun.";
      
      if (error.message.includes("certificate") || error.message.includes("SSL")) {
        remedy = "⚠️ SSL Sertifika Hatası tespit edildi! VPS üzerinde self-signed sertifika kullanıyorsanız, .env dosyasına NODE_TLS_REJECT_UNAUTHORIZED=0 eklemeyi veya Qdrant adresini HTTP üzerinden (port 6333) kullanmayı deneyin.";
      } else if (error.message.includes("Compatibility") || error.message.includes("version")) {
        remedy = "💡 Versiyon uyumsuzluğu! checkCompatibility: false ayarı yapıldı ancak sunucu yanıt vermiyor. Qdrant versiyonunuzun güncel olduğundan emin olun.";
      }

      return {
        service: "Qdrant",
        status: "ERROR",
        message: `Bağlantı hatası: ${error.message}`,
        remedy
      };
    }
  }

  public async checkSupabase(): Promise<DiagnosticResult> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      return {
        service: "Supabase",
        status: "WARNING",
        message: "Değişkenler eksik.",
        remedy: "SUPABASE_URL ve SUPABASE_KEY tanımlayın."
      };
    }
    const supabase = createClient(this.supabaseUrl, this.supabaseKey);
    try {
      const { data, error } = await supabase.from("orders").select("id").limit(1);
      if (error) throw error;
      return {
        service: "Supabase",
        status: "OK",
        message: "Bağlantı başarılı, 'orders' tablosu erişilebilir."
      };
    } catch (error: any) {
      return {
        service: "Supabase",
        status: "ERROR",
        message: `Bağlantı/Sorgu hatası: ${error.message}`,
        remedy: "Veritabanı şemasının (schema.sql) yüklendiğinden ve API anahtarının doğru olduğundan emin olun."
      };
    }
  }

  /**
   * Bir hata mesajını LLM'e göndererek teknik çözüm önerisi alır.
   */
  public async getSelfCorrectionAdvice(errorResult: DiagnosticResult): Promise<string> {
    try {
      const prompt = `Sistemde bir teknik hata oluştu. 
Servis: ${errorResult.service}
Hata Mesajı: ${errorResult.message}
Sen bir sistem yöneticisi ve yazılımcısın. Bu hatayı analiz et ve Barış Bey'e (SuperAdmin) uygulaması gereken KISA ve NET bir çözüm talimatı ver. 
Eğer sorun VPS yapılandırmasıyla ilgiliyse Docker veya .env ipuçları ver.`;

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash",
        messages: [{ role: "system", content: "Sen Ayça Asistan'ın teknik doktorusun." }, { role: "user", content: prompt }],
      });

      return response.choices[0].message.content || "Çözüm önerisi oluşturulamadı.";
    } catch (e) {
      return "LLM üzerinden çözüm önerisi alınırken hata oluştu.";
    }
  }

  public async checkLLM(): Promise<DiagnosticResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5
      });
      return {
        service: "LLM (OpenRouter)",
        status: "OK",
        message: `Bağlantı başarılı. Model: ${process.env.OPENROUTER_MODEL}`
      };
    } catch (error: any) {
      return {
        service: "LLM (OpenRouter)",
        status: "ERROR",
        message: `API Hatası: ${error.message}`,
        remedy: "OPENROUTER_API_KEY geçerliliğini ve kotasını kontrol edin."
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
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
      return {
        service: "Gmail (IMAP)",
        status: "OK",
        message: "Giriş başarılı."
      };
    } catch (error: any) {
      return {
        service: "Gmail (IMAP)",
        status: "ERROR",
        message: `Bağlantı hatası: ${error.message}`,
        remedy: "GMAIL_PASS olarak 'Uygulama Şifresi' kullandığınızdan ve 2FA'nın aktif olduğundan emin olun."
      };
    }
  }

  public async runFullDiagnostics(): Promise<DiagnosticResult[]> {
    logger.info("🩺 Sistem taraması başlatılıyor...");
    const results: DiagnosticResult[] = [];
    results.push(await this.checkQdrant());
    results.push(await this.checkSupabase());
    results.push(await this.checkLLM());
    results.push(await this.checkGmail());
    return results;
  }

  public formatReport(results: DiagnosticResult[]): string {
    let report = "🩺 *SİSTEM SAĞLIK RAPORU (DOCTOR)*\n\n";
    results.forEach(res => {
      const icon = res.status === "OK" ? "✅" : res.status === "WARNING" ? "⚠️" : "❌";
      report += `${icon} *${res.service}*: ${res.status}\n`;
      report += `📝 _${res.message}_\n`;
      if (res.remedy) {
        report += `💡 *Çözüm:* ${res.remedy}\n`;
      }
      report += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
    });
    
    const errors = results.filter(r => r.status === "ERROR").length;
    if (errors === 0) {
      report += "\n🚀 *Sistem stabil durumda. VPS geçişi için hazır.*";
    } else {
      report += `\n⚠️ *${errors} adet kritik hata bulundu.* Lütfen çözümleri uygulayın.`;
    }
    
    return report;
  }
}
