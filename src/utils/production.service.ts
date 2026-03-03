import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export type ProductionStatus =
  | "requested"
  | "ordered"
  | "received"
  | "cancelled";

export interface ProductionItem {
  id: string;
  name: string;
  quantity?: string;
  status: ProductionStatus;
  createdAt: string;
  updatedAt: string;
  requestedBy: string;
  notes?: string;
}

export class ProductionService {
  private static storagePath = path.join(
    process.cwd(),
    "data",
    "production.json",
  );

  constructor() {
    this.ensureStorageExists();
  }

  private ensureStorageExists() {
    const dir = path.dirname(ProductionService.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(ProductionService.storagePath)) {
      fs.writeFileSync(
        ProductionService.storagePath,
        JSON.stringify([], null, 2),
      );
    }
  }

  async getAll(): Promise<ProductionItem[]> {
    const data = fs.readFileSync(ProductionService.storagePath, "utf8");
    return JSON.parse(data);
  }

  async add(
    item: Omit<ProductionItem, "id" | "createdAt" | "updatedAt" | "status">,
  ): Promise<ProductionItem> {
    const items = await this.getAll();
    const newItem: ProductionItem = {
      ...item,
      id: uuidv4(),
      status: "requested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    items.push(newItem);
    this.save(items);
    return newItem;
  }

  async updateStatus(id: string, status: ProductionStatus): Promise<boolean> {
    const items = await this.getAll();
    const index = items.findIndex((i) => i.id === id);
    if (index !== -1) {
      items[index].status = status;
      items[index].updatedAt = new Date().toISOString();
      this.save(items);
      return true;
    }
    return false;
  }

  async getPending(): Promise<ProductionItem[]> {
    const items = await this.getAll();
    return items.filter(
      (i) => i.status === "requested" || i.status === "ordered",
    );
  }

  private save(items: ProductionItem[]) {
    fs.writeFileSync(
      ProductionService.storagePath,
      JSON.stringify(items, null, 2),
    );
  }
}
