import { z } from "zod";

export const createContactSchema = z.object({
  entityId: z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;
