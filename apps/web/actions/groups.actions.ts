"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  addUserToGroup,
  addUserToGroupSchema,
  createGroup,
  createGroupSchema,
  getGroup,
  recordAuditLog,
  removeUserFromGroup,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * `schema.parse()` throws a `ZodError` whose `.message` getter is a JSON blob
 * (see zod's ZodError#message), not a human-readable string - same reasoning
 * as the identical helper in apps/web/actions/api-clients.actions.ts. Use
 * `.safeParse` and rethrow a clean, semicolon-joined message so forms can
 * surface `err.message` directly.
 */
function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

export async function createGroupAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_GROUP, RIGHT.CREATE);
  const parsed = parseInput(createGroupSchema, input);
  const group = await createGroup(parsed);
  await recordAuditLog({
    entityId: group.entityId,
    actorUserId: context.user.id,
    action: "create",
    objectType: "group",
    objectId: group.id,
    after: group,
  });
  revalidatePath("/administration/groups");
  return group;
}

export async function addUserToGroupAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_GROUP, RIGHT.ASSIGN);
  const parsed = parseInput(addUserToGroupSchema, input);
  await addUserToGroup(parsed.userId, parsed.groupId, parsed.isManager);
  const group = await getGroup(parsed.groupId);
  await recordAuditLog({
    entityId: group?.entityId ?? context.activeEntity.id,
    actorUserId: context.user.id,
    action: "update",
    objectType: "group_member",
    objectId: parsed.groupId,
    after: { userId: parsed.userId, groupId: parsed.groupId, isManager: parsed.isManager ?? false },
  });
  revalidatePath(`/administration/groups/${parsed.groupId}`);
}

export async function removeUserFromGroupAction(userId: string, groupId: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_GROUP, RIGHT.ASSIGN);
  await removeUserFromGroup(userId, groupId);
  const group = await getGroup(groupId);
  await recordAuditLog({
    entityId: group?.entityId ?? context.activeEntity.id,
    actorUserId: context.user.id,
    action: "delete",
    objectType: "group_member",
    objectId: groupId,
    before: { userId, groupId },
  });
  revalidatePath(`/administration/groups/${groupId}`);
}
