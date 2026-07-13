import { z } from "zod";

export const submitInventorySchema = z.object({
  deviceId: z.string().min(1),
  entityId: z.string().uuid(),
  hostname: z.string().min(1),
  serialNumber: z.string().nullable().optional(),
  macAddresses: z.array(z.string()).optional(),
  os: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
});
export type SubmitInventoryInput = z.infer<typeof submitInventorySchema>;
