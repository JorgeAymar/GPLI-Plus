import { z } from "zod";

export const createComputerSchema = z.object({
  entityId: z.string().uuid(),
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
  osDropdownItemId: z.string().uuid().nullable().optional(),
  osVersionDropdownItemId: z.string().uuid().nullable().optional(),
  domain: z.string().max(255).nullable().optional(),
});
export type CreateComputerInput = z.infer<typeof createComputerSchema>;

export const assetComponentTypeSchema = z.enum(["cpu", "ram", "disk", "gpu", "psu", "motherboard", "nic", "other"]);

export const addAssetComponentSchema = z.object({
  assetId: z.string().uuid(),
  componentType: assetComponentTypeSchema,
  name: z.string().min(1).max(255),
  quantity: z.number().int().min(1).optional(),
  capacityValue: z.number().int().nullable().optional(),
  capacityUnit: z.string().max(50).nullable().optional(),
  serialNumber: z.string().max(255).nullable().optional(),
});
export type AddAssetComponentInput = z.infer<typeof addAssetComponentSchema>;
