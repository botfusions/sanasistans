import { z } from "zod";

// ─── OrderItem Zod Schema ───────────────────────────────────────────────────

export const OrderItemStatusSchema = z.enum([
  "bekliyor",
  "uretimde",
  "boyada",
  "dikiste",
  "dosemede",
  "hazir",
  "sevk_edildi",
  "arsivlendi",
]);

export const OrderItemSourceSchema = z.enum([
  "Stock",
  "Production",
  "External",
]);

export const FabricDetailsSchema = z.object({
  name: z.string(),
  amount: z.number().nonnegative(),
  arrived: z.boolean(),
  issueNote: z.string().optional(),
});

export const OrderItemSchema = z.object({
  id: z.string().min(1),
  product: z.string().min(1),
  department: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  details: z.string(),
  source: OrderItemSourceSchema,
  imageUrl: z.string().url().optional(),
  rowIndex: z.number().int().optional(),
  imageBuffer: z.instanceof(Buffer).optional(),
  imageExtension: z.string().optional(),
  status: OrderItemStatusSchema,
  assignedWorker: z.string().optional(),
  distributedAt: z.string().datetime({ offset: true }).optional(),
  fabricDetails: FabricDetailsSchema.optional(),
  lastReminderAt: z.string().datetime({ offset: true }).optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

// ─── OrderDetail Zod Schema ─────────────────────────────────────────────────

export const OrderDetailStatusSchema = z.enum([
  "new",
  "processing",
  "completed",
  "archived",
]);

export const OrderDetailSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().min(1),
  customerName: z.string().min(1),
  items: z.array(OrderItemSchema),
  deliveryDate: z.string().min(1),
  status: OrderDetailStatusSchema,
  isDuplicate: z.boolean().optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

// ─── TypeScript Types (inferred from Zod) ──────────────────────────────────

export type OrderItemStatus = z.infer<typeof OrderItemStatusSchema>;
export type OrderItemSource = z.infer<typeof OrderItemSourceSchema>;
export type FabricDetails = z.infer<typeof FabricDetailsSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;

export type OrderDetailStatus = z.infer<typeof OrderDetailStatusSchema>;
export type OrderDetail = z.infer<typeof OrderDetailSchema>;
