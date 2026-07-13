import { z } from "zod";

export const createAssetSchema = z.object({
  entityId: z.string().uuid(),
  assetDefinitionId: z.string().uuid(),
  name: z.string().min(1).max(255),
  serialNumber: z.string().max(255).nullable().optional(),
  inventoryNumber: z.string().max(255).nullable().optional(),
  statusDropdownItemId: z.string().uuid().nullable().optional(),
  manufacturerDropdownItemId: z.string().uuid().nullable().optional(),
  modelDropdownItemId: z.string().uuid().nullable().optional(),
  locationDropdownItemId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
  customFields: z.unknown().optional(),
});
export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const updateAssetSchema = createAssetSchema.omit({ entityId: true, assetDefinitionId: true }).partial();
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

export const assignAssetSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
});
export type AssignAssetInput = z.infer<typeof assignAssetSchema>;
