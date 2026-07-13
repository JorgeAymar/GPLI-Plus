import { z } from "zod";

export const contractTypeSchema = z.enum(["maintenance", "lease", "license", "support", "other"]);
export const billingFrequencySchema = z.enum(["monthly", "quarterly", "annual", "one_time"]);

export const createContractSchema = z.object({
  entityId: z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  contractType: contractTypeSchema.optional(),
  billingFrequency: billingFrequencySchema.optional(),
  costCents: z.number().int().min(0).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  renewalNoticeDays: z.number().int().min(0).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

export const linkContractAssetSchema = z.object({
  contractId: z.string().uuid(),
  assetId: z.string().uuid(),
});
export type LinkContractAssetInput = z.infer<typeof linkContractAssetSchema>;
