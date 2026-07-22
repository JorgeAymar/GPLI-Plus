import { z } from "zod";

export const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  interface: z.enum(["central", "simplified"]),
  description: z.string().max(500).nullable().optional(),
});
export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const assignUserProfileSchema = z.object({
  userId: z.string().uuid(),
  profileId: z.string().uuid(),
  entityId: z.string().uuid(),
  isRecursive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
export type AssignUserProfileInput = z.infer<typeof assignUserProfileSchema>;
