import { z } from "zod";

export const createComputerSchema = z.object({
  entityId: z.guid(),
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
  osDropdownItemId: z.guid().nullable().optional(),
  osVersionDropdownItemId: z.guid().nullable().optional(),
  domain: z.string().max(255).nullable().optional(),
});
export type CreateComputerInput = z.infer<typeof createComputerSchema>;

export const assetComponentTypeSchema = z.enum(["cpu", "ram", "disk", "gpu", "psu", "motherboard", "nic", "other"]);

export const addAssetComponentSchema = z.object({
  assetId: z.guid(),
  componentType: assetComponentTypeSchema,
  name: z.string().min(1).max(255),
  quantity: z.number().int().min(1).optional(),
  capacityValue: z.number().int().nullable().optional(),
  capacityUnit: z.string().max(50).nullable().optional(),
  serialNumber: z.string().max(255).nullable().optional(),
});
export type AddAssetComponentInput = z.infer<typeof addAssetComponentSchema>;
