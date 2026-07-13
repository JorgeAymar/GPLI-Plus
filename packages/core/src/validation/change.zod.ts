import { z } from "zod";

export const createChangeSchema = z.object({
  entityId: z.string().uuid(),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(20000),
  urgency: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  categoryDropdownItemId: z.string().uuid().nullable().optional(),
  plannedStartAt: z.coerce.date().nullable().optional(),
  plannedEndAt: z.coerce.date().nullable().optional(),
});
export type CreateChangeInput = z.infer<typeof createChangeSchema>;

export const updateChangeSchema = createChangeSchema.omit({ entityId: true }).partial();
export type UpdateChangeInput = z.infer<typeof updateChangeSchema>;
