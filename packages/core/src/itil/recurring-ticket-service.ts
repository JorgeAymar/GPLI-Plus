import { db, recurringTicketTemplates, type RecurringTicketTemplate, type TicketType } from "@itsm/db";
import { and, eq, inArray, lte } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";
import { createTicket } from "./ticket-service";

export async function createRecurringTicketTemplate(input: {
  entityId: string;
  name: string;
  titleTemplate: string;
  contentTemplate: string;
  ticketType?: TicketType;
  requesterUserId: string;
  intervalMinutes: number;
}): Promise<RecurringTicketTemplate> {
  const [created] = await db
    .insert(recurringTicketTemplates)
    .values({
      entityId: input.entityId,
      name: input.name,
      titleTemplate: input.titleTemplate,
      contentTemplate: input.contentTemplate,
      ticketType: input.ticketType ?? "request",
      requesterUserId: input.requesterUserId,
      intervalMinutes: input.intervalMinutes,
      nextRunAt: new Date(Date.now() + input.intervalMinutes * 60_000),
    })
    .returning();
  if (!created) throw new Error("Failed to insert recurring ticket template");
  return created;
}

export async function listRecurringTicketTemplates(
  entityId: string,
  options?: { includeSubtree?: boolean },
): Promise<RecurringTicketTemplate[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(recurringTicketTemplates)
    .where(and(inArray(recurringTicketTemplates.entityId, entityIds), eq(recurringTicketTemplates.isActive, true)))
    .orderBy(recurringTicketTemplates.name);
}

/**
 * Fires every due template into a real ticket and reschedules nextRunAt.
 * Called on a recurring schedule by apps/worker. Simple watermark instead of
 * a cron parser - see schema comment on recurring_ticket_templates.
 */
export async function runRecurringTicketsSweep(): Promise<number> {
  const now = new Date();
  const due = await db
    .select()
    .from(recurringTicketTemplates)
    .where(and(eq(recurringTicketTemplates.isActive, true), lte(recurringTicketTemplates.nextRunAt, now)));

  for (const template of due) {
    await createTicket(
      {
        entityId: template.entityId,
        title: template.titleTemplate,
        content: template.contentTemplate,
        ticketType: template.ticketType,
      },
      template.requesterUserId,
    );

    await db
      .update(recurringTicketTemplates)
      .set({ nextRunAt: new Date(now.getTime() + template.intervalMinutes * 60_000), updatedAt: now })
      .where(eq(recurringTicketTemplates.id, template.id));
  }

  return due.length;
}
