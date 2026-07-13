import { z } from "zod";

export const createGroupSchema = z.object({
  entityId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const addUserToGroupSchema = z.object({
  userId: z.string().uuid(),
  groupId: z.string().uuid(),
  isManager: z.boolean().optional(),
});
export type AddUserToGroupInput = z.infer<typeof addUserToGroupSchema>;
