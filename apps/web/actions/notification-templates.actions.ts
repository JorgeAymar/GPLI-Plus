"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createNotificationTemplate, createNotificationTemplateSchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createNotificationTemplateAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_NOTIFICATION_TEMPLATE, RIGHT.CREATE);
  const parsed = createNotificationTemplateSchema.parse(input);
  const template = await createNotificationTemplate(parsed);
  revalidatePath("/setup/notification-templates");
  return template;
}
