import { auditLog, db, entities, itilActors, queuedNotifications, ticketFieldDefinitions, tickets, users, type Entity, type User } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createUser } from "../users/user-service";
import { listActors } from "./itil-shared-service";
import { createTicketFieldDefinition } from "./ticket-field-service";
import { createTicket, getTicket, listTickets, listTicketsForRequester, updateTicket, updateTicketStatus } from "./ticket-service";

const PREFIX = "__vitest_itil__ticket_service";

let entity: Entity;
let requester: User;
const ticketIds: string[] = [];

beforeAll(async () => {
  entity = await createEntity({ name: `${PREFIX}_entity_${Date.now()}` });
  requester = await createUser({
    email: `${PREFIX}_${Date.now()}@example.test`,
    username: `${PREFIX}_${Date.now()}`,
    password: "not-used-in-tests",
    displayName: `${PREFIX} requester`,
  });
});

afterAll(async () => {
  // FK-safe order: satellite rows (no real FK to tickets, but cleaned up for hygiene) ->
  // queued side effects (recipientUserId FKs to users) -> audit trail (entityId/actorUserId FK
  // to entities/users) -> the tickets themselves (entityId FK to entities) -> the entity/user
  // they belong to.
  if (ticketIds.length > 0) {
    await db.delete(itilActors).where(inArray(itilActors.itilId, ticketIds));
  }
  await db.delete(queuedNotifications).where(eq(queuedNotifications.recipientUserId, requester.id));
  await db.delete(auditLog).where(eq(auditLog.entityId, entity.id));
  if (ticketIds.length > 0) {
    await db.delete(tickets).where(inArray(tickets.id, ticketIds));
  }
  await db.delete(entities).where(eq(entities.id, entity.id));
  await db.delete(users).where(eq(users.id, requester.id));
});

describe("ticket-service", () => {
  it("creates a ticket with defaults and auto-adds the creator as the requester actor", async () => {
    const ticket = await createTicket({ entityId: entity.id, title: "Impresora no imprime", content: "No sale nada" }, requester.id);
    ticketIds.push(ticket.id);

    expect(ticket.ticketType).toBe("incident");
    expect(ticket.urgency).toBe(3);
    expect(ticket.impact).toBe(3);
    expect(ticket.priority).toBe(3);
    expect(ticket.status).toBe("new");
    expect(ticket.customFields).toEqual({});

    const actors = await listActors("ticket", ticket.id);
    expect(actors).toHaveLength(1);
    expect(actors[0]).toMatchObject({ actorRole: "requester", actorKind: "user", actorId: requester.id });
  });

  it("records an audit log entry on create", async () => {
    const ticket = await createTicket({ entityId: entity.id, title: "Audit check", content: "content" }, requester.id);
    ticketIds.push(ticket.id);

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.objectId, ticket.id));
    expect(rows.some((r) => r.action === "create" && r.objectType === "ticket")).toBe(true);
  });

  it("getTicket / listTickets / listTicketsForRequester round-trip", async () => {
    const ticket = await createTicket({ entityId: entity.id, title: "Round trip", content: "content" }, requester.id);
    ticketIds.push(ticket.id);

    const fetched = await getTicket(ticket.id);
    expect(fetched?.id).toBe(ticket.id);

    const listed = await listTickets(entity.id);
    expect(listed.map((t) => t.id)).toContain(ticket.id);

    const mine = await listTicketsForRequester(requester.id);
    expect(mine.map((t) => t.id)).toContain(ticket.id);
  });

  it("filters listTickets by status", async () => {
    const ticket = await createTicket({ entityId: entity.id, title: "Status filter", content: "content" }, requester.id);
    ticketIds.push(ticket.id);

    const newOnes = await listTickets(entity.id, { status: "new" });
    expect(newOnes.map((t) => t.id)).toContain(ticket.id);

    const solvedOnes = await listTickets(entity.id, { status: "solved" });
    expect(solvedOnes.map((t) => t.id)).not.toContain(ticket.id);
  });

  it("updateTicket updates plain fields and records an audit log entry", async () => {
    const ticket = await createTicket({ entityId: entity.id, title: "Before", content: "content" }, requester.id);
    ticketIds.push(ticket.id);

    const updated = await updateTicket(ticket.id, { title: "After" }, requester.id);
    expect(updated.title).toBe("After");

    const rows = await db.select().from(auditLog).where(eq(auditLog.objectId, ticket.id));
    expect(rows.some((r) => r.action === "update")).toBe(true);
  });

  it("updateTicketStatus stamps solvedAt/closedAt and records a status_change audit entry", async () => {
    const ticket = await createTicket({ entityId: entity.id, title: "Lifecycle", content: "content" }, requester.id);
    ticketIds.push(ticket.id);

    const solved = await updateTicketStatus(ticket.id, "solved", requester.id);
    expect(solved.status).toBe("solved");
    expect(solved.solvedAt).toBeInstanceOf(Date);
    expect(solved.closedAt).toBeNull();

    const closed = await updateTicketStatus(ticket.id, "closed", requester.id);
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).toBeInstanceOf(Date);

    const rows = await db.select().from(auditLog).where(eq(auditLog.objectId, ticket.id));
    expect(rows.filter((r) => r.action === "status_change")).toHaveLength(2);
  });

  it("rejects ticket creation when a required custom field is missing, and creates it once all required fields are present", async () => {
    // Scoped to the real "incident" type on purpose (Form Builder custom fields only apply if
    // they match the ticket's real ticketType) - cleaned up immediately in `finally` so this
    // temporary global requirement can't leak into any other test, in this file or another.
    const requiredKey = `${PREFIX}_required_department`;
    const fieldDef = await createTicketFieldDefinition({
      ticketType: "incident",
      key: requiredKey,
      label: "Departamento",
      fieldType: "text",
      isRequired: true,
    });

    try {
      await expect(
        createTicket({ entityId: entity.id, title: "Missing field", content: "content", ticketType: "incident" }, requester.id),
      ).rejects.toThrow();

      const ticket = await createTicket(
        {
          entityId: entity.id,
          title: "All fields present",
          content: "content",
          ticketType: "incident",
          customFields: { [requiredKey]: "Soporte" },
        },
        requester.id,
      );
      ticketIds.push(ticket.id);

      expect(ticket.customFields).toEqual({ [requiredKey]: "Soporte" });
    } finally {
      await db.delete(ticketFieldDefinitions).where(eq(ticketFieldDefinitions.id, fieldDef.id));
    }
  });
});
