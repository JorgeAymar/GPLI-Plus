import { z } from "zod";

export const createProblemSchema = z.object({
  entityId: z.string().uuid(),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(20000),
  urgency: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  categoryDropdownItemId: z.string().uuid().nullable().optional(),
});
export type CreateProblemInput = z.infer<typeof createProblemSchema>;

export const updateProblemSchema = createProblemSchema.omit({ entityId: true }).partial();
export type UpdateProblemInput = z.infer<typeof updateProblemSchema>;
