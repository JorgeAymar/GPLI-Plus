import { z } from "zod";

export const createAssetSchema = z.object({
  entityId: z.guid(),
  assetDefinitionId: z.guid(),
  name: z.string().min(1).max(255),
  serialNumber: z.string().max(255).nullable().optional(),
  inventoryNumber: z.string().max(255).nullable().optional(),
  statusDropdownItemId: z.guid().nullable().optional(),
  manufacturerDropdownItemId: z.guid().nullable().optional(),
  modelDropdownItemId: z.guid().nullable().optional(),
  locationDropdownItemId: z.guid().nullable().optional(),
  userId: z.guid().nullable().optional(),
  groupId: z.guid().nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
  customFields: z.unknown().optional(),
});
export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const updateAssetSchema = createAssetSchema.omit({ entityId: true, assetDefinitionId: true }).partial();
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

export const assignAssetSchema = z.object({
  userId: z.guid().nullable().optional(),
  groupId: z.guid().nullable().optional(),
});
export type AssignAssetInput = z.infer<typeof assignAssetSchema>;
