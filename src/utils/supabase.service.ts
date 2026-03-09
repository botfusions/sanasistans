import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

export class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient;

  private constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;

    if (!url || !key) {
      console.warn("⚠️ Supabase credentials are missing in .env!");
      // Error handling or placeholder client
    }

    this.client = createClient(url || "", key || "");
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // --- Orders ---
  async upsertOrder(order: any) {
    const { data, error } = await this.client.from("orders").upsert(
      {
        id: order.id.toString(),
        order_number: order.orderNumber,
        customer_name: order.customerName,
        delivery_date: order.deliveryDate,
        status: order.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) throw error;
    return data;
  }

  // --- Order Items ---
  async upsertOrderItem(item: any, orderId: string, index?: number) {
    // ID yoksa orderId_index formatında üret
    const itemId =
      item.id ||
      `${orderId}_${index ?? Math.random().toString(36).substr(2, 9)}`;

    const { data, error } = await this.client.from("order_items").upsert(
      {
        id: itemId,
        order_id: orderId,
        product: item.product,
        department: item.department,
        quantity: item.quantity,
        details: item.details,
        source: item.source,
        image_url: item.imageUrl,
        status: item.status,
        assigned_worker: item.assignedWorker,
        fabric_name: item.fabricDetails?.name,
        fabric_amount: item.fabricDetails?.amount,
        fabric_arrived: item.fabricDetails?.arrived,
        fabric_issue_note: item.fabricDetails?.issueNote,
        last_reminder_at: item.lastReminderAt,
        row_index: item.rowIndex,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) throw error;
    return data;
  }

  // --- Staff ---
  async getAllStaff() {
    const { data, error } = await this.client.from("staff").select("*");

    if (error) throw error;
    return data;
  }

  async upsertStaff(staff: any) {
    // telegram_id üzerinden deterministik bir UUID benzeri yapı oluştur (veya rastgele)
    // Supabase'de id UUID tipinde olduğu için geçerli bir UUID göndermeliyiz.
    const staffId = staff.id && staff.id.length > 10 ? staff.id : undefined;

    const { data, error } = await this.client.from("staff").upsert(
      {
        id: staffId, // id varsa gönder, yoksa Supabase üretemiyor (auth.uid() null dönüyor)
        telegram_id: staff.telegramId,
        name: staff.name,
        department: staff.department,
        role: staff.role,
        phone: staff.phone,
        is_marina: staff.isMarina,
      },
      { onConflict: "telegram_id" },
    );

    if (error) throw error;
    return data;
  }

  async deleteStaff(telegramId: number) {
    const { error } = await this.client
      .from("staff")
      .delete()
      .eq("telegram_id", telegramId.toString());

    if (error) throw error;
    return true;
  }

  // --- Visual Memory (pgvector) ---
  async upsertVisualMemory(
    id: string,
    productName: string,
    customerName: string,
    orderId: string,
    tags: string[],
    vector: number[],
    filePath: string,
  ) {
    const { data, error } = await this.client.from("visual_memory").upsert(
      {
        id,
        product_name: productName,
        customer_name: customerName,
        order_id: orderId,
        tags,
        vector, // pgvector column
        file_path: filePath,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) throw error;
    return data;
  }

  async searchVisualMemory(
    queryVector: number[],
    matchThreshold = 0.7,
    matchCount = 3,
  ) {
    const { data, error } = await this.client.rpc("match_visual_memory", {
      query_embedding: queryVector,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      console.error("Supabase RPC Error match_visual_memory:", error);
      throw error;
    }

    return data;
  }

  // --- Queries ---
  async getActiveOrders() {
    const { data, error } = await this.client
      .from("orders")
      .select("*, order_items(*)")
      .neq("status", "archived");

    if (error) throw error;
    return data;
  }
}
