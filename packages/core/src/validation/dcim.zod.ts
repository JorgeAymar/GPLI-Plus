import { z } from "zod";

export const rackSlotOrientationSchema = z.enum(["front", "rear"]);

export const placeInRackSchema = z.object({
  rackAssetId: z.string().uuid(),
  occupantAssetId: z.string().uuid(),
  positionU: z.number().int().min(1),
  unitHeight: z.number().int().min(1).optional(),
  orientation: rackSlotOrientationSchema.optional(),
});
export type PlaceInRackInput = z.infer<typeof placeInRackSchema>;

export const placeInEnclosureSchema = z.object({
  enclosureAssetId: z.string().uuid(),
  occupantAssetId: z.string().uuid(),
  positionSlot: z.number().int().min(1),
});
export type PlaceInEnclosureInput = z.infer<typeof placeInEnclosureSchema>;

export const addClusterMemberSchema = z.object({
  clusterAssetId: z.string().uuid(),
  memberAssetId: z.string().uuid(),
});
export type AddClusterMemberInput = z.infer<typeof addClusterMemberSchema>;

export const createCableSchema = z.object({
  name: z.string().max(255).nullable().optional(),
  endpointAAssetId: z.string().uuid(),
  endpointBAssetId: z.string().uuid(),
  cableTypeDropdownItemId: z.string().uuid().nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateCableInput = z.infer<typeof createCableSchema>;
