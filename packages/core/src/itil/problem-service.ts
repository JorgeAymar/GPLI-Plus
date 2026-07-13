import { db, problems, type ItilStatus, type Problem } from "@itsm/db";
import { and, eq, inArray } from "drizzle-orm";
import { recordAuditLog } from "../audit/audit-service";
import { listSubtree } from "../entities/entity-service";
import type { CreateProblemInput } from "../validation/problem.zod";
import { addActor } from "./itil-shared-service";

/** Mirrors ticket-service.ts - see that file for the shared reasoning (auto-requester-actor, status side effects). */
export async function createProblem(input: CreateProblemInput, requesterUserId: string): Promise<Problem> {
  const [created] = await db
    .insert(problems)
    .values({
      entityId: input.entityId,
      title: input.title,
      content: input.content,
      urgency: input.urgency ?? 3,
      impact: input.impact ?? 3,
      priority: input.priority ?? 3,
      categoryDropdownItemId: input.categoryDropdownItemId ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert problem");

  await addActor("problem", created.id, { actorRole: "requester", actorKind: "user", actorId: requesterUserId });

  await recordAuditLog({
    entityId: created.entityId,
    actorUserId: requesterUserId,
    action: "create",
    objectType: "problem",
    objectId: created.id,
    after: created,
  });

  return created;
}

export async function getProblem(id: string): Promise<Problem | undefined> {
  const [row] = await db.select().from(problems).where(eq(problems.id, id));
  return row;
}

export async function listProblems(
  entityId: string,
  options?: { status?: ItilStatus; includeSubtree?: boolean },
): Promise<Problem[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  const conditions = [inArray(problems.entityId, entityIds)];
  if (options?.status) conditions.push(eq(problems.status, options.status));
  return db
    .select()
    .from(problems)
    .where(and(...conditions))
    .orderBy(problems.createdAt);
}

export async function updateProblem(
  id: string,
  input: Partial<Omit<CreateProblemInput, "entityId">>,
  actorUserId: string | null,
): Promise<Problem> {
  const before = await getProblem(id);
  if (!before) throw new Error(`Problem ${id} not found`);

  const [updated] = await db.update(problems).set({ ...input, updatedAt: new Date() }).where(eq(problems.id, id)).returning();
  if (!updated) throw new Error(`Problem ${id} not found`);

  await recordAuditLog({ entityId: updated.entityId, actorUserId, action: "update", objectType: "problem", objectId: id, before, after: updated });
  return updated;
}

export async function updateProblemStatus(id: string, status: ItilStatus, actorUserId: string | null): Promise<Problem> {
  const before = await getProblem(id);
  if (!before) throw new Error(`Problem ${id} not found`);

  const patch: { status: ItilStatus; updatedAt: Date; solvedAt?: Date; closedAt?: Date } = { status, updatedAt: new Date() };
  if (status === "solved") patch.solvedAt = new Date();
  if (status === "closed") patch.closedAt = new Date();

  const [updated] = await db.update(problems).set(patch).where(eq(problems.id, id)).returning();
  if (!updated) throw new Error(`Problem ${id} not found`);

  await recordAuditLog({
    entityId: updated.entityId,
    actorUserId,
    action: "status_change",
    objectType: "problem",
    objectId: id,
    before: { status: before.status },
    after: { status: updated.status },
  });

  return updated;
}
