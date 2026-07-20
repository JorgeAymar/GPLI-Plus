"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createNotificationTemplate, createNotificationTemplateSchema, requireRight } from "@itsm/core";
import type { NotificationTemplate } from "@itsm/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * `schema.parse()` throws a `ZodError` whose `.message` getter is a JSON blob
 * (see zod's ZodError#message), not a human-readable string. Every setup form
 * surfaces server-action errors via `err.message`, so parsing this way turns
 * validation failures into unreadable JSON dumped in the UI. Use `.safeParse`
 * instead and rethrow a clean, semicolon-joined message.
 */
function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

export interface CreateNotificationTemplateResult {
  template?: NotificationTemplate;
  error?: string;
}

/**
 * Returns `{error}` instead of throwing on a validation/uniqueness failure -
 * Next.js redacts thrown Server Action errors in production (see
 * users.actions.ts's createUserAction for the full explanation).
 */
export async function createNotificationTemplateAction(input: unknown): Promise<CreateNotificationTemplateResult> {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_NOTIFICATION_TEMPLATE, RIGHT.CREATE);

  let template: NotificationTemplate;
  try {
    const parsed = parseInput(createNotificationTemplateSchema, input);
    template = await createNotificationTemplate(parsed);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear la plantilla." };
  }
  revalidatePath("/setup/notification-templates");
  return { template };
}
