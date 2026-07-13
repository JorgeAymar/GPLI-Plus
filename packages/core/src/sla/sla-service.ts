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

/**
 * Scans for assignments past their dueAt that aren't marked breached yet,
 * flips them, and writes an audit_log row for each. Called on a recurring
 * schedule by apps/worker - see apps/worker/src/jobs/sla-escalation.ts.
 */
export async function runSlaEscalationSweep(): Promise<number> {
  const now = new Date();
  const overdue = await db
    .select()
    .from(itilSlaAssignments)
    .where(and(eq(itilSlaAssignments.isBreached, false), lt(itilSlaAssignments.dueAt, now)));

  for (const assignment of overdue) {
    await db
      .update(itilSlaAssignments)
      .set({ isBreached: true, breachedAt: now })
      .where(eq(itilSlaAssignments.id, assignment.id));

    // audit_log.entityId has a FK to entities.id, so skip the audit entry (rather than inserting
    // a bogus id) if the parent itil object is somehow gone - the isBreached flip above still stands.
    const entityId = await getAssignmentEntityId(assignment);
    if (entityId) {
      // No per-entity actor here (system-triggered, not a user action) - audit_log.actorUserId stays null.
      await recordAuditLog({
        entityId,
        actorUserId: null,
        action: "sla_breach",
        objectType: `${assignment.itilType}_sla`,
        objectId: assignment.id,
        after: { slaType: assignment.slaType, dueAt: assignment.dueAt },
      });
    }
  }

  return overdue.length;
}

// audit_log.entityId is required; resolve it from the parent ticket/problem/change row rather
// than skipping the audit entry entirely.
const ITIL_TABLES = { ticket: tickets, problem: problems, change: changes } as const;

async function getAssignmentEntityId(assignment: ItilSlaAssignment): Promise<string | null> {
  const table = ITIL_TABLES[assignment.itilType];
  const [row] = await db.select({ entityId: table.entityId }).from(table).where(eq(table.id, assignment.itilId));
  return row?.entityId ?? null;
}
