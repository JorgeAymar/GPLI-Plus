import { z } from "zod";

export const createNetworkEquipmentSchema = z.object({
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
  ipAddress: z.string().max(64).nullable().optional(),
  macAddress: z.string().max(64).nullable().optional(),
  deviceTypeDropdownItemId: z.string().uuid().nullable().optional(),
  firmwareVersion: z.string().max(100).nullable().optional(),
  portsCount: z.number().int().min(0).nullable().optional(),
});
export type CreateNetworkEquipmentInput = z.infer<typeof createNetworkEquipmentSchema>;
