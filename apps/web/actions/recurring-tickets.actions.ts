"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createRecurringTicketTemplate,
  createRecurringTicketTemplateSchema,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createRecurringTicketTemplateAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_TICKET, RIGHT.CREATE);
  const parsed = createRecurringTicketTemplateSchema.parse(input);
  const template = await createRecurringTicketTemplate(parsed);
  revalidatePath("/assistance/recurring-tickets");
  return template;
}
