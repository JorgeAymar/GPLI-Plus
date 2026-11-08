import { z } from "zod";

export const createGroupSchema = z.object({
  entityId: z.guid(),
  parentId: z.guid().nullable().optional(),
  name: z.string().min(1).max(255),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const addUserToGroupSchema = z.object({
  userId: z.guid(),
  groupId: z.guid(),
  isManager: z.boolean().optional(),
});
export type AddUserToGroupInput = z.infer<typeof addUserToGroupSchema>;
