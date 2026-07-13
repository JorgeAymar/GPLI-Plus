"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createEntity,
  createEntitySchema,
  moveEntity,
  moveEntitySchema,
  recordAuditLog,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createEntityAction(input: { name: string; parentId?: string | null; comment?: string | null }) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_ENTITY, RIGHT.CREATE);
  const parsed = createEntitySchema.parse(input);
  const entity = await createEntity(parsed);
  await recordAuditLog({
    entityId: entity.id,
    actorUserId: context.user.id,
    action: "create",
    objectType: "entity",
    objectId: entity.id,
    after: entity,
  });
  revalidatePath("/administration/entities");
  return entity;
}

export async function moveEntityAction(input: { entityId: string; newParentId: string | null }) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_ENTITY, RIGHT.UPDATE);
  const parsed = moveEntitySchema.parse(input);
  const entity = await moveEntity(parsed.entityId, parsed.newParentId);
  await recordAuditLog({
    entityId: entity.id,
    actorUserId: context.user.id,
    action: "update",
    objectType: "entity",
    objectId: entity.id,
    after: entity,
  });
  revalidatePath("/administration/entities");
  return entity;
}
