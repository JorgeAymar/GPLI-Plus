"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createReminder, createReminderSchema, markReminderDone, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createReminderAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_REMINDER, RIGHT.CREATE);
  const parsed = createReminderSchema.parse(input);
  // ownerUserId always comes from the session, never from client input.
  const reminder = await createReminder({ ...parsed, ownerUserId: context.user.id });
  revalidatePath("/tools/reminders");
  return reminder;
}

export async function markReminderDoneAction(id: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_REMINDER, RIGHT.UPDATE);
  const reminder = await markReminderDone(id);
  revalidatePath("/tools/reminders");
  return reminder;
}
