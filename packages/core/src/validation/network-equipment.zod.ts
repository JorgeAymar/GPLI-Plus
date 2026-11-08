import { z } from "zod";

export const createNetworkEquipmentSchema = z.object({
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
  ipAddress: z.string().max(64).nullable().optional(),
  macAddress: z.string().max(64).nullable().optional(),
  deviceTypeDropdownItemId: z.guid().nullable().optional(),
  firmwareVersion: z.string().max(100).nullable().optional(),
  portsCount: z.number().int().min(0).nullable().optional(),
});
export type CreateNetworkEquipmentInput = z.infer<typeof createNetworkEquipmentSchema>;
