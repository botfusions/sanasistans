import fs from "fs";
import path from "path";
import { SupabaseService } from "./supabase.service";

export interface Staff {
  id?: string;
  telegramId?: number;
  name: string;
  department: string;
  role: string;
  phone?: string;
  language: "tr" | "ru";
  isMarina?: boolean;
}

export class StaffService {
  private static instance: StaffService;
  private supabase: SupabaseService;
  private staffFilePath: string;
  private staffList: Staff[] = [];

  private constructor() {
    this.supabase = SupabaseService.getInstance();
    this.staffFilePath = path.resolve(process.cwd(), "data", "staff.json");
    this.ensureDataDirectory();
    this.loadStaffFromSupabase(); // Başlangıçta DB'den çek
  }

  public static getInstance(): StaffService {
    if (!StaffService.instance) {
      StaffService.instance = new StaffService();
    }
    return StaffService.instance;
  }

  private ensureDataDirectory() {
    const dataDir = path.dirname(this.staffFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.staffFilePath)) {
      fs.writeFileSync(this.staffFilePath, JSON.stringify([], null, 2));
    }
  }

  private async loadStaffFromSupabase() {
    try {
      const data = await this.supabase.getAllStaff();
      if (data) {
        // DB'den gelen veriyi yerel interface ile uyumlu hale getir (snake_case -> camelCase)
        this.staffList = data.map((s: any) => ({
          id: s.id,
          telegramId: s.telegram_id,
          name: s.name,
          department: s.department,
          role: s.role,
          phone: s.phone,
          language: s.language || "ru",
          isMarina: s.is_marina,
        }));
        this.saveToLocalFile(); // Yerelde yedekle
      }
    } catch (error) {
      console.error(
        "❌ Personel DB'den yüklenemedi, yerel dosyaya dönülüyor:",
        error,
      );
      this.loadFromLocalFile();
    }
  }

  private loadFromLocalFile() {
    try {
      if (fs.existsSync(this.staffFilePath)) {
        const data = fs.readFileSync(this.staffFilePath, "utf-8");
        this.staffList = JSON.parse(data);
      }
    } catch (err) {
      console.error("❌ Yerel personel dosyası okunamadı:", err);
    }
  }

  private saveToLocalFile() {
    try {
      fs.writeFileSync(
        this.staffFilePath,
        JSON.stringify(this.staffList, null, 2),
      );
    } catch (error) {
      console.error("❌ Personel yerel dosyaya kaydedilemedi:", error);
    }
  }

  public getStaffByTelegramId(telegramId: number): Staff | undefined {
    return this.staffList.find((s) => s.telegramId === telegramId);
  }

  public getStaffByDepartment(department: string): Staff[] {
    const staff = this.staffList.filter(
      (s) =>
        s.department.toLowerCase().includes(department.toLowerCase()) ||
        department.toLowerCase().includes(s.department.toLowerCase()),
    );

    // TEST MODU İÇİN: Eğer bu departmanda hiç personel kayıtlı değilse,
    // test işlemlerini yürütebilmeniz için sizin Telegram ID'nizi geçici olarak atıyoruz.
    if (staff.length === 0 && process.env.TELEGRAM_CHAT_ID) {
      return [
        {
          telegramId: Number(process.env.TELEGRAM_CHAT_ID),
          name: `Test Ustası (${department})`,
          department: department,
          role: "Personnel",
          language: "tr",
        },
      ];
    }

    return staff;
  }

  public getStaffByName(name: string): Staff | undefined {
    const staff = this.staffList.find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );

    // Sanal test personeli aranıyorsa doğrudan sanal bir obje döndür
    if (
      !staff &&
      name.startsWith("Test Ustası") &&
      process.env.TELEGRAM_CHAT_ID
    ) {
      return {
        telegramId: Number(process.env.TELEGRAM_CHAT_ID),
        name: name,
        department: "Test",
        role: "Personnel",
        language: "tr",
      };
    }

    return staff;
  }

  /**
   * TEST AMAÇLI: Tüm departmanları kullanıcı ID'sine yönlendirmek için.
   */
  public getTestStaff(telegramId: number): Staff {
    return {
      telegramId,
      name: "Test Personeli",
      department: "Test",
      role: "Personnel",
      language: "ru",
    };
  }

  public getMarina(): Staff | undefined {
    return this.staffList.find((s) => s.isMarina === true);
  }

  public getAllStaff(): Staff[] {
    return this.staffList;
  }

  public async registerStaff(
    telegramId: number,
    name: string,
    department: string,
    phone?: string,
  ) {
    const staffData = {
      telegramId,
      name,
      department,
      phone,
      role: "Personnel",
      language: "ru" as const,
    };

    try {
      await this.supabase.upsertStaff(staffData);
      // DB başarılıysa yerel listeyi tazele
      await this.loadStaffFromSupabase();
    } catch (error) {
      console.error("❌ Personel DB'ye kaydedilemedi:", error);
      throw error;
    }
  }

  public async removeStaff(telegramId: number): Promise<boolean> {
    const index = this.staffList.findIndex((s) => s.telegramId === telegramId);
    if (index !== -1) {
      try {
        await this.supabase.deleteStaff(telegramId);
        this.staffList.splice(index, 1);
        this.saveToLocalFile();
        return true;
      } catch (error) {
        console.error("❌ Personel DB'den silinemedi:", error);
        return false;
      }
    }
    return false;
  }

  public isBoss(telegramId: number): boolean {
    // 1. .env'deki TELEGRAM_BOSS_ID kontrolü (En güvenli yöntem)
    const bossId = process.env.TELEGRAM_BOSS_ID;
    if (bossId && telegramId.toString() === bossId) {
      return true;
    }

    // 2. Staff listesindeki role kontrolü (Yedek yöntem)
    const staff = this.getStaffByTelegramId(telegramId);
    return staff?.role === "SuperAdmin";
  }

  public getDepartments(): string[] {
    return [
      "Karkas Üretimi",
      "Metal Üretimi",
      "Mobilya Dekorasyon",
      "Dikişhane",
      "Döşemehane",
      "Boyahane",
      "Kalite Kontrol",
      "Paketleme",
      "Sevkiyat",
    ];
  }
}
