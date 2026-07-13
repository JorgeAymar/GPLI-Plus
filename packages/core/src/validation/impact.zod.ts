import { z } from "zod";

export const addImpactRelationSchema = z
  .object({
    sourceAssetId: z.string().uuid(),
    impactedAssetId: z.string().uuid(),
    label: z.string().max(255).nullable().optional(),
  })
  .refine((data) => data.sourceAssetId !== data.impactedAssetId, {
    message: "Un activo no puede depender de sí mismo",
    path: ["impactedAssetId"],
  });
export type AddImpactRelationInput = z.infer<typeof addImpactRelationSchema>;
