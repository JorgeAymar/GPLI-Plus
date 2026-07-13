import { z } from "zod";

export const createSupplierSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
