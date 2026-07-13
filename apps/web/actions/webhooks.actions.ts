"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createWebhook, createWebhookSchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createWebhookAction(input: {
  entityId: string;
  name: string;
  itemType: string;
  event: "create" | "update" | "delete";
  url: string;
  secret: string;
  customHeaders?: Record<string, string>;
  maxRetries?: number;
}) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_WEBHOOK, RIGHT.CREATE);
  const parsed = createWebhookSchema.parse(input);
  const webhook = await createWebhook(parsed);
  revalidatePath("/setup/webhooks");
  return webhook;
}
