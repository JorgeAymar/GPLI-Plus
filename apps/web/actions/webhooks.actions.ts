"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createWebhook, createWebhookSchema, requireRight } from "@itsm/core";
import type { Webhook } from "@itsm/db";
import { revalidatePath } from "next/cache";

export interface CreateWebhookResult {
  webhook?: Webhook;
  error?: string;
}

/**
 * Returns `{error}` instead of throwing - Next.js redacts anything a Server
 * Action *throws* across the client/server boundary in production builds,
 * replacing it with a generic "an error occurred" message regardless of how
 * safe the original message was. See apps/web/actions/users.actions.ts's
 * createUserAction for the same fix with the full explanation.
 */
export async function createWebhookAction(input: {
  entityId: string;
  name: string;
  itemType: string;
  event: "create" | "update" | "delete";
  url: string;
  secret: string;
  customHeaders?: Record<string, string>;
  maxRetries?: number;
}): Promise<CreateWebhookResult> {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_WEBHOOK, RIGHT.CREATE);

  const parsedResult = createWebhookSchema.safeParse(input);
  if (!parsedResult.success) return { error: parsedResult.error.issues.map((issue) => issue.message).join("; ") };

  let webhook: Webhook;
  try {
    webhook = await createWebhook(parsedResult.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear el webhook." };
  }

  revalidatePath("/setup/webhooks");
  return { webhook };
}
