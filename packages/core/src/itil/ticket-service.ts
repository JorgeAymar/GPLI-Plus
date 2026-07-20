import { db, itilActors, tickets, type ItilStatus, type Ticket } from "@itsm/db";
import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { recordAuditLog } from "../audit/audit-service";
import { listSubtree } from "../entities/entity-service";
import { getNotificationTemplateByKey, queueNotification } from "../notifications/notification-service";
import type { CreateTicketInput } from "../validation/ticket.zod";
import { raiseWebhookEvent } from "../webhooks/webhook-service";
import { addActor, listActors } from "./itil-shared-service";
import { validateTicketCustomFields } from "./ticket-field-service";

/** Creates the ticket and auto-adds the creating user as its "requester" actor. */
export async function createTicket(input: CreateTicketInput, requesterUserId: string): Promise<Ticket> {
  const ticketType = input.ticketType ?? "incident";
  const validatedCustomFields = await validateTicketCustomFields(ticketType, input.customFields);

  const [created] = await db
    .insert(tickets)
    .values({
      entityId: input.entityId,
      title: input.title,
      content: input.content,
      ticketType,
      urgency: input.urgency ?? 3,
      impact: input.impact ?? 3,
      priority: input.priority ?? 3,
      categoryDropdownItemId: input.categoryDropdownItemId ?? null,
      customFields: validatedCustomFields,
    })
    .returning();
  if (!created) throw new Error("Failed to insert ticket");

  await addActor("ticket", created.id, { actorRole: "requester", actorKind: "user", actorId: requesterUserId });

  await recordAuditLog({
    entityId: created.entityId,
    actorUserId: requesterUserId,
    action: "create",
    objectType: "ticket",
    objectId: created.id,
    after: created,
  });

  await raiseWebhookEvent("ticket", "create", created.entityId, created).catch(() => {});

  return created;
}

export async function getTicket(id: string): Promise<Ticket | undefined> {
  const [row] = await db.select().from(tickets).where(eq(tickets.id, id));
  return row;
}

interface TicketListOptions {
  status?: ItilStatus;
  includeSubtree?: boolean;
  /** Matched (case-insensitive, substring) against title and content. */
  search?: string;
}

async function buildTicketListConditions(entityId: string, options?: TicketListOptions): Promise<SQL[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  const conditions: SQL[] = [inArray(tickets.entityId, entityIds)];
  if (options?.status) conditions.push(eq(tickets.status, options.status));
  if (options?.search) {
    const pattern = `%${options.search}%`;
    const searchCondition = or(ilike(tickets.title, pattern), ilike(tickets.content, pattern));
    if (searchCondition) conditions.push(searchCondition);
  }
  return conditions;
}

/** Newest first. `limit`/`offset` are optional so existing unpaginated callers (public API, tests) keep getting the full result set. */
export async function listTickets(
  entityId: string,
  options?: TicketListOptions & { limit?: number; offset?: number },
): Promise<Ticket[]> {
  const conditions = await buildTicketListConditions(entityId, options);
  let query = db
    .select()
    .from(tickets)
    .where(and(...conditions))
    .orderBy(desc(tickets.createdAt))
    .$dynamic();
  if (options?.limit !== undefined) query = query.limit(options.limit);
  if (options?.offset !== undefined) query = query.offset(options.offset);
  return query;
}

/** Same filters as listTickets, for computing total page count instead of fetching rows. */
export async function countTickets(entityId: string, options?: TicketListOptions): Promise<number> {
  const conditions = await buildTicketListConditions(entityId, options);
  const [row] = await db
    .select({ value: count() })
    .from(tickets)
    .where(and(...conditions));
  return row?.value ?? 0;
}

export async function updateTicket(
  id: string,
  input: Partial<Omit<CreateTicketInput, "entityId">>,
  actorUserId: string | null,
): Promise<Ticket> {
  const before = await getTicket(id);
  if (!before) throw new Error(`Ticket ${id} not found`);

  // Only re-validate custom_fields when the input actually touches it - avoids forcing every
  // plain-field update (e.g. just `title`) to also re-validate an unrelated JSONB blob.
  const customFields =
    input.customFields !== undefined
      ? await validateTicketCustomFields(input.ticketType ?? before.ticketType, input.customFields)
      : undefined;

  const [updated] = await db
    .update(tickets)
    .set({ ...input, customFields, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();
  if (!updated) throw new Error(`Ticket ${id} not found`);

  await recordAuditLog({ entityId: updated.entityId, actorUserId, action: "update", objectType: "ticket", objectId: id, before, after: updated });

  await raiseWebhookEvent("ticket", "update", updated.entityId, updated).catch(() => {});

  return updated;
}

/** Status transitions stamp solvedAt/closedAt as a side effect - kept separate from generic field updates. */
export async function updateTicketStatus(id: string, status: ItilStatus, actorUserId: string | null): Promise<Ticket> {
  const before = await getTicket(id);
  if (!before) throw new Error(`Ticket ${id} not found`);

  const patch: { status: ItilStatus; updatedAt: Date; solvedAt?: Date; closedAt?: Date } = { status, updatedAt: new Date() };
  if (status === "solved") patch.solvedAt = new Date();
  if (status === "closed") patch.closedAt = new Date();

  const [updated] = await db.update(tickets).set(patch).where(eq(tickets.id, id)).returning();
  if (!updated) throw new Error(`Ticket ${id} not found`);

  await recordAuditLog({
    entityId: updated.entityId,
    actorUserId,
    action: "status_change",
    objectType: "ticket",
    objectId: id,
    before: { status: before.status },
    after: { status: updated.status },
  });

  // Notify requesters when their ticket is solved - only if the template exists (seed-dependent,
  // so it degrades to "no notification" rather than throwing if Setup hasn't created it yet).
  if (status === "solved" && (await getNotificationTemplateByKey("ticket_solved"))) {
    const requesters = (await listActors("ticket", id)).filter((a) => a.actorRole === "requester" && a.actorKind === "user");
    for (const requester of requesters) {
      await queueNotification("ticket_solved", requester.actorId, { ticketTitle: updated.title, ticketId: updated.id });
    }
  }

  return updated;
}

/** Tickets where the user is the "requester" actor - powers the self-service portal's "My tickets". */
export async function listTicketsForRequester(userId: string): Promise<Ticket[]> {
  const requesterLinks = await db
    .select({ itilId: itilActors.itilId })
    .from(itilActors)
    .where(and(eq(itilActors.itilType, "ticket"), eq(itilActors.actorRole, "requester"), eq(itilActors.actorKind, "user"), eq(itilActors.actorId, userId)));

  if (requesterLinks.length === 0) return [];

  return db
    .select()
    .from(tickets)
    .where(
      inArray(
        tickets.id,
        requesterLinks.map((l) => l.itilId),
      ),
    )
    .orderBy(tickets.createdAt);
}
