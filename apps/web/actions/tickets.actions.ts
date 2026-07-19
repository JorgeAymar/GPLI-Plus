"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createTicket,
  createTicketSchema,
  getTicket,
  itilStatusSchema,
  requireRight,
  requireRightOnEntity,
  updateTicket,
  updateTicketSchema,
  updateTicketStatus,
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

export async function createTicketAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_TICKET, RIGHT.CREATE);
  const parsed = parseInput(createTicketSchema, input);
  const ticket = await createTicket(parsed, context.user.id);
  revalidatePath("/assistance/tickets");
  // Also used by the self-service portal's ticket form (portal-ticket-form-client.tsx) -
  // without this, a ticket created there never showed up in "Mis solicitudes" (which reads
  // via listTicketsForRequester in a Server Component) until an unrelated navigation happened
  // to revalidate it.
  revalidatePath("/portal");
  return ticket;
}

/**
 * `requireRight` alone only proves the caller has UPDATE *wherever they're currently
 * standing* (their active entity) - for a specific existing ticket, that's the wrong entity
 * to check. Fetch the ticket first and check the right against its own entity instead, so a
 * caller with UPDATE in their own entity can't write to a ticket that lives in a different
 * entity they were never assigned to.
 */
async function requireTicketRight(id: string, required: number) {
  const context = await requireAuthContext();
  const ticket = await getTicket(id);
  if (!ticket) throw new Error(`Ticket ${id} not found`);
  await requireRightOnEntity(context, MODULE.ASSISTANCE_TICKET, required, ticket.entityId);
  return context;
}

export async function updateTicketAction(id: string, input: unknown) {
  const context = await requireTicketRight(id, RIGHT.UPDATE);
  const parsed = parseInput(updateTicketSchema, input);
  const ticket = await updateTicket(id, parsed, context.user.id);
  revalidatePath(`/assistance/tickets/${id}`);
  return ticket;
}

export async function updateTicketStatusAction(id: string, status: unknown) {
  const context = await requireTicketRight(id, RIGHT.UPDATE);
  const parsedStatus = parseInput(itilStatusSchema, status);
  const ticket = await updateTicketStatus(id, parsedStatus, context.user.id);
  revalidatePath(`/assistance/tickets/${id}`);
  return ticket;
}
