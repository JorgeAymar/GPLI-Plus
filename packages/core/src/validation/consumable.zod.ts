import { z } from "zod";

export const createConsumableItemSchema = z.object({
  entityId: z.guid(),
  name: z.string().min(1).max(255),
  supplierId: z.guid().nullable().optional(),
  alertThreshold: z.number().int().min(0).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateConsumableItemInput = z.infer<typeof createConsumableItemSchema>;

export const addConsumableUnitsSchema = z.object({
  consumableItemId: z.guid(),
  quantity: z.number().int().min(1).max(1000),
});
export type AddConsumableUnitsInput = z.infer<typeof addConsumableUnitsSchema>;

export const useConsumableSchema = z.object({
  id: z.guid(),
  assignedAssetId: z.guid(),
});
export type UseConsumableInput = z.infer<typeof useConsumableSchema>;
