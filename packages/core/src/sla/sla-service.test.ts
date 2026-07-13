import { auditLog, db, entities, itilActors, itilSlaAssignments, slaPolicies, tickets, users, type Entity, type User } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createTicket } from "../itil/ticket-service";
import { createUser } from "../users/user-service";
import {
  assignSla,
  createSlaPolicy,
  getSlaPolicy,
  listSlaAssignments,
  listSlaPolicies,
  runSlaEscalationSweep,
} from "./sla-service";

const PREFIX = "__vitest_itil__sla_service";

let entity: Entity;
let requester: User;
let ticketId: string;
const policyIds: string[] = [];
const assignmentIds: string[] = [];

beforeAll(async () => {
  entity = await createEntity({ name: `${PREFIX}_entity_${Date.now()}` });
  requester = await createUser({
    email: `${PREFIX}_${Date.now()}@example.test`,
    username: `${PREFIX}_${Date.now()}`,
    password: "not-used-in-tests",
    displayName: `${PREFIX} requester`,
  });
  const ticket = await createTicket({ entityId: entity.id, title: "SLA target ticket", content: "content" }, requester.id);
  ticketId = ticket.id;
});

afterAll(async () => {
  if (assignmentIds.length > 0) {
    await db.delete(itilSlaAssignments).where(inArray(itilSlaAssignments.id, assignmentIds));
  }
  await db.delete(itilActors).where(eq(itilActors.itilId, ticketId));
  await db.delete(auditLog).where(eq(auditLog.entityId, entity.id));
  await db.delete(tickets).where(eq(tickets.id, ticketId));
  if (policyIds.length > 0) {
    await db.delete(slaPolicies).where(inArray(slaPolicies.id, policyIds));
  }
  await db.delete(entities).where(eq(entities.id, entity.id));
  await db.delete(users).where(eq(users.id, requester.id));
});

describe("sla-service", () => {
  it("creates an SLA policy and lists it for its entity", async () => {
    const policy = await createSlaPolicy({ entityId: entity.id, name: `${PREFIX} standard`, ttoMinutes: 30, ttrMinutes: 480 });
    policyIds.push(policy.id);

    expect(policy.isActive).toBe(true);

    const fetched = await getSlaPolicy(policy.id);
    expect(fetched?.id).toBe(policy.id);

    const listed = await listSlaPolicies(entity.id);
    expect(listed.map((p) => p.id)).toContain(policy.id);
  });

  it("assignSla computes dueAt from the policy's target minutes for the requested slaType", async () => {
    const policy = await createSlaPolicy({ entityId: entity.id, name: `${PREFIX} tto-30`, ttoMinutes: 30, ttrMinutes: 480 });
    policyIds.push(policy.id);

    const before = Date.now();
    const assignment = await assignSla("ticket", ticketId, { slaPolicyId: policy.id, slaType: "tto" });
    assignmentIds.push(assignment.id);

    const expectedDueAt = before + 30 * 60_000;
    expect(Math.abs(assignment.dueAt.getTime() - expectedDueAt)).toBeLessThan(5000);
    expect(assignment.isBreached).toBe(false);

    const assignments = await listSlaAssignments("ticket", ticketId);
    expect(assignments.map((a) => a.id)).toContain(assignment.id);
  });

  it("assignSla for ttr uses ttrMinutes independently from tto", async () => {
    const policy = await createSlaPolicy({ entityId: entity.id, name: `${PREFIX} ttr-480`, ttoMinutes: 30, ttrMinutes: 480 });
    policyIds.push(policy.id);

    const before = Date.now();
    const assignment = await assignSla("ticket", ticketId, { slaPolicyId: policy.id, slaType: "ttr" });
    assignmentIds.push(assignment.id);

    const expectedDueAt = before + 480 * 60_000;
    expect(Math.abs(assignment.dueAt.getTime() - expectedDueAt)).toBeLessThan(5000);
  });

  it("throws when assigning an SLA type the policy doesn't configure a target for", async () => {
    const policy = await createSlaPolicy({ entityId: entity.id, name: `${PREFIX} tto-only`, ttoMinutes: 15, ttrMinutes: null });
    policyIds.push(policy.id);

    await expect(assignSla("ticket", ticketId, { slaPolicyId: policy.id, slaType: "ttr" })).rejects.toThrow();
  });

  it("throws when the SLA policy doesn't exist", async () => {
    await expect(
      assignSla("ticket", ticketId, { slaPolicyId: "00000000-0000-0000-0000-000000000000", slaType: "tto" }),
    ).rejects.toThrow();
  });

  it("runSlaEscalationSweep flips overdue assignments to breached and leaves future ones alone", async () => {
    const policy = await createSlaPolicy({ entityId: entity.id, name: `${PREFIX} escalation`, ttoMinutes: 30, ttrMinutes: 30 });
    policyIds.push(policy.id);

    const overdue = await assignSla("ticket", ticketId, { slaPolicyId: policy.id, slaType: "tto" });
    assignmentIds.push(overdue.id);
    // Force it into the past to simulate a breach the way the real worker sweep would find it.
    await db
      .update(itilSlaAssignments)
      .set({ dueAt: new Date(Date.now() - 60_000) })
      .where(eq(itilSlaAssignments.id, overdue.id));

    const notYetDue = await assignSla("ticket", ticketId, { slaPolicyId: policy.id, slaType: "ttr" });
    assignmentIds.push(notYetDue.id);

    // runSlaEscalationSweep() scans every overdue assignment system-wide, not just ours, so
    // assert on our own rows rather than the global returned count.
    await runSlaEscalationSweep();

    const [reloadedOverdue] = await db.select().from(itilSlaAssignments).where(eq(itilSlaAssignments.id, overdue.id));
    expect(reloadedOverdue?.isBreached).toBe(true);
    expect(reloadedOverdue?.breachedAt).toBeInstanceOf(Date);

    const [reloadedNotYetDue] = await db.select().from(itilSlaAssignments).where(eq(itilSlaAssignments.id, notYetDue.id));
    expect(reloadedNotYetDue?.isBreached).toBe(false);

    const breachRows = await db.select().from(auditLog).where(eq(auditLog.objectId, overdue.id));
    expect(breachRows.some((r) => r.action === "sla_breach")).toBe(true);
  });
});
