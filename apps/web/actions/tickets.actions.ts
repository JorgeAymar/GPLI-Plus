"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createTicket,
  createTicketSchema,
  itilStatusSchema,
  requireRight,
  updateTicket,
  updateTicketSchema,
  updateTicketStatus,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createTicketAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_TICKET, RIGHT.CREATE);
  const parsed = createTicketSchema.parse(input);
  const ticket = await createTicket(parsed, context.user.id);
  revalidatePath("/assistance/tickets");
  return ticket;
}

export async function updateTicketAction(id: string, input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_TICKET, RIGHT.UPDATE);
  const parsed = updateTicketSchema.parse(input);
  const ticket = await updateTicket(id, parsed, context.user.id);
  revalidatePath(`/assistance/tickets/${id}`);
  return ticket;
}

export async function updateTicketStatusAction(id: string, status: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_TICKET, RIGHT.UPDATE);
  const parsedStatus = itilStatusSchema.parse(status);
  const ticket = await updateTicketStatus(id, parsedStatus, context.user.id);
  revalidatePath(`/assistance/tickets/${id}`);
  return ticket;
}
