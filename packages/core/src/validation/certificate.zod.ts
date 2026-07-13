import { z } from "zod";

export const certificateTypeSchema = z.enum(["ssl", "code_signing", "other"]);

export const createCertificateSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  certificateType: certificateTypeSchema.optional(),
  issuer: z.string().max(255).nullable().optional(),
  serialNumber: z.string().max(255).nullable().optional(),
  validFrom: z.coerce.date().nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  assignedAssetId: z.string().uuid().nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateCertificateInput = z.infer<typeof createCertificateSchema>;
