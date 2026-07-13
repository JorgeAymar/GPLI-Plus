"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createTicketFieldDefinition, createTicketFieldDefinitionSchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createTicketFieldDefinitionAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_TICKET_FIELD, RIGHT.CREATE);
  const parsed = createTicketFieldDefinitionSchema.parse(input);
  const field = await createTicketFieldDefinition(parsed);
  revalidatePath("/setup/ticket-fields");
  return field;
}
