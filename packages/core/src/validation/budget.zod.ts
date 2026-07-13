import { z } from "zod";

export const createBudgetSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  amountCents: z.number().int().min(0),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
