import {
  changes,
  db,
  itilSlaAssignments,
  problems,
  slaPolicies,
  tickets,
  type ItilSlaAssignment,
  type ItilType,
  type SlaPolicy,
  type SlaType,
} from "@itsm/db";
import { and, eq, inArray, lt } from "drizzle-orm";
import { recordAuditLog } from "../audit/audit-service";
import { listSubtree } from "../entities/entity-service";

export async function createSlaPolicy(input: {
  entityId: string;
  name: string;
  description?: string | null;
  ttoMinutes?: number | null;
  ttrMinutes?: number | null;
}): Promise<SlaPolicy> {
  const [created] = await db
    .insert(slaPolicies)
    .values({
      entityId: input.entityId,
      name: input.name,
      description: input.description ?? null,
      ttoMinutes: input.ttoMinutes ?? null,
      ttrMinutes: input.ttrMinutes ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert SLA policy");
  return created;
}

export async function getSlaPolicy(id: string): Promise<SlaPolicy | undefined> {
  const [row] = await db.select().from(slaPolicies).where(eq(slaPolicies.id, id));
  return row;
}

export async function listSlaPolicies(entityId: string, options?: { includeSubtree?: boolean }): Promise<SlaPolicy[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(slaPolicies)
    .where(and(inArray(slaPolicies.entityId, entityIds), eq(slaPolicies.isActive, true)))
    .orderBy(slaPolicies.name);
}

/** dueAt is computed from the policy's target minutes for the given slaType, starting from now. */
export async function assignSla(
  itilType: ItilType,
  itilId: string,
  input: { slaPolicyId: string; slaType: SlaType },
): Promise<ItilSlaAssignment> {
  const policy = await getSlaPolicy(input.slaPolicyId);
  if (!policy) throw new Error(`SLA policy ${input.slaPolicyId} not found`);

  const targetMinutes = input.slaType === "tto" ? policy.ttoMinutes : policy.ttrMinutes;
  if (targetMinutes == null) throw new Error(`SLA policy "${policy.name}" has no ${input.slaType} target configured`);

  const dueAt = new Date(Date.now() + targetMinutes * 60_000);

  const [created] = await db
    .insert(itilSlaAssignments)
    .values({ itilType, itilId, slaPolicyId: input.slaPolicyId, slaType: input.slaType, dueAt })
    .returning();
  if (!created) throw new Error("Failed to insert SLA assignment");
  return created;
}

export async function listSlaAssignments(itilType: ItilType, itilId: string): Promise<ItilSlaAssignment[]> {
  return db
    .select()
    .from(itilSlaAssignments)
    .where(and(eq(itilSlaAssignments.itilType, itilType), eq(itilSlaAssignments.itilId, itilId)));
}

const TERMINAL_STATUSES = new Set(["solved", "closed"]);

// audit_log.entityId is required; resolve it (and the parent's current status) from the
// parent ticket/problem/change row.
const ITIL_TABLES = { ticket: tickets, problem: problems, change: changes } as const;

async function getAssignmentParent(assignment: ItilSlaAssignment): Promise<{ entityId: string; status: string } | null> {
  const table = ITIL_TABLES[assignment.itilType];
  const [row] = await db.select({ entityId: table.entityId, status: table.status }).from(table).where(eq(table.id, assignment.itilId));
  return row ?? null;
}

/**
 * Scans for assignments past their dueAt that aren't marked breached yet,
 * flips them, and writes an audit_log row for each. Called on a recurring
 * schedule by apps/worker - see apps/worker/src/jobs/sla-escalation.ts.
 *
 * Only flips assignments whose parent ticket/problem/change is still open. Without this
 * check, ANY item resolved on time still gets retroactively marked breached the moment
 * real-world clock time passes its (long-since-irrelevant) dueAt - `dueAt` is a fixed point
 * set once at assignment, so a naive `dueAt < now` comparison eventually goes true for every
 * assignment ever created, regardless of how quickly the underlying item was actually solved.
 * A still-open, overdue item is a genuine breach; an already-resolved item is not, no matter
 * how much time has passed since.
 */
export async function runSlaEscalationSweep(): Promise<number> {
  const now = new Date();
  const candidates = await db
    .select()
    .from(itilSlaAssignments)
    .where(and(eq(itilSlaAssignments.isBreached, false), lt(itilSlaAssignments.dueAt, now)));

  let breachedCount = 0;
  for (const assignment of candidates) {
    const parent = await getAssignmentParent(assignment);
    if (!parent || TERMINAL_STATUSES.has(parent.status)) continue;

    await db
      .update(itilSlaAssignments)
      .set({ isBreached: true, breachedAt: now })
      .where(eq(itilSlaAssignments.id, assignment.id));
    breachedCount++;

    // No per-entity actor here (system-triggered, not a user action) - audit_log.actorUserId stays null.
    await recordAuditLog({
      entityId: parent.entityId,
      actorUserId: null,
      action: "sla_breach",
      objectType: `${assignment.itilType}_sla`,
      objectId: assignment.id,
      after: { slaType: assignment.slaType, dueAt: assignment.dueAt },
    });
  }

  return breachedCount;
}
