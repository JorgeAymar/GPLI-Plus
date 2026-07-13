import { changes, db, type Change, type ItilStatus } from "@itsm/db";
import { and, eq, inArray } from "drizzle-orm";
import { recordAuditLog } from "../audit/audit-service";
import { listSubtree } from "../entities/entity-service";
import type { CreateChangeInput } from "../validation/change.zod";
import { addActor } from "./itil-shared-service";

/** Mirrors ticket-service.ts - see that file for the shared reasoning (auto-requester-actor, status side effects). */
export async function createChange(input: CreateChangeInput, requesterUserId: string): Promise<Change> {
  const [created] = await db
    .insert(changes)
    .values({
      entityId: input.entityId,
      title: input.title,
      content: input.content,
      urgency: input.urgency ?? 3,
      impact: input.impact ?? 3,
      priority: input.priority ?? 3,
      categoryDropdownItemId: input.categoryDropdownItemId ?? null,
      plannedStartAt: input.plannedStartAt ?? null,
      plannedEndAt: input.plannedEndAt ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert change");

  await addActor("change", created.id, { actorRole: "requester", actorKind: "user", actorId: requesterUserId });

  await recordAuditLog({
    entityId: created.entityId,
    actorUserId: requesterUserId,
    action: "create",
    objectType: "change",
    objectId: created.id,
    after: created,
  });

  return created;
}

export async function getChange(id: string): Promise<Change | undefined> {
  const [row] = await db.select().from(changes).where(eq(changes.id, id));
  return row;
}

export async function listChanges(
  entityId: string,
  options?: { status?: ItilStatus; includeSubtree?: boolean },
): Promise<Change[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  const conditions = [inArray(changes.entityId, entityIds)];
  if (options?.status) conditions.push(eq(changes.status, options.status));
  return db
    .select()
    .from(changes)
    .where(and(...conditions))
    .orderBy(changes.createdAt);
}

export async function updateChange(
  id: string,
  input: Partial<Omit<CreateChangeInput, "entityId">>,
  actorUserId: string | null,
): Promise<Change> {
  const before = await getChange(id);
  if (!before) throw new Error(`Change ${id} not found`);

  const [updated] = await db.update(changes).set({ ...input, updatedAt: new Date() }).where(eq(changes.id, id)).returning();
  if (!updated) throw new Error(`Change ${id} not found`);

  await recordAuditLog({ entityId: updated.entityId, actorUserId, action: "update", objectType: "change", objectId: id, before, after: updated });
  return updated;
}

export async function updateChangeStatus(id: string, status: ItilStatus, actorUserId: string | null): Promise<Change> {
  const before = await getChange(id);
  if (!before) throw new Error(`Change ${id} not found`);

  const patch: { status: ItilStatus; updatedAt: Date; solvedAt?: Date; closedAt?: Date } = { status, updatedAt: new Date() };
  if (status === "solved") patch.solvedAt = new Date();
  if (status === "closed") patch.closedAt = new Date();

  const [updated] = await db.update(changes).set(patch).where(eq(changes.id, id)).returning();
  if (!updated) throw new Error(`Change ${id} not found`);

  await recordAuditLog({
    entityId: updated.entityId,
    actorUserId,
    action: "status_change",
    objectType: "change",
    objectId: id,
    before: { status: before.status },
    after: { status: updated.status },
  });

  return updated;
}
