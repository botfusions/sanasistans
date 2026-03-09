export interface DraftOrder {
  order: any;
  images: any[];
  excelRows?: any[];
  assignments: Record<string, number>; // Departman -> TelegramId
}

/**
 * Geçici sipariş verilerini onay beklerken saklamak için basit bir servis.
 */
export class DraftOrderService {
  private static instance: DraftOrderService;
  private pendingOrders: Map<string, DraftOrder> = new Map();

  private constructor() {}

  static getInstance(): DraftOrderService {
    if (!DraftOrderService.instance) {
      DraftOrderService.instance = new DraftOrderService();
    }
    return DraftOrderService.instance;
  }

  saveDraft(
    id: string,
    data: { order: any; images: any[]; excelRows?: any[] },
  ) {
    this.pendingOrders.set(id, {
      ...data,
      assignments: {},
    });
    // 30 dakika sonra temizle
    setTimeout(() => this.pendingOrders.delete(id), 30 * 60 * 1000);
  }

  updateAssignment(id: string, dept: string, telegramId: number) {
    const draft = this.pendingOrders.get(id);
    if (draft) {
      draft.assignments[dept] = telegramId;
    }
  }

  getDraft(id: string) {
    return this.pendingOrders.get(id);
  }

  removeDraft(id: string) {
    this.pendingOrders.delete(id);
  }
}
