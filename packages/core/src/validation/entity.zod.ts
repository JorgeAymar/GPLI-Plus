import { z } from "zod";

export const createEntitySchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
});
export type CreateEntityInput = z.infer<typeof createEntitySchema>;

export const moveEntitySchema = z.object({
  entityId: z.string().uuid(),
  newParentId: z.string().uuid().nullable(),
});
export type MoveEntityInput = z.infer<typeof moveEntitySchema>;
