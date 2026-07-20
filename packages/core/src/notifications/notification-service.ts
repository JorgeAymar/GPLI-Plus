import {
  db,
  notificationTemplates,
  queuedNotifications,
  users,
  type NotificationTemplate,
  type QueuedNotification,
} from "@itsm/db";
import { eq } from "drizzle-orm";
import type { NotificationTransport } from "./transport";

export async function createNotificationTemplate(input: {
  key: string;
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
}): Promise<NotificationTemplate> {
  let created: NotificationTemplate | undefined;
  try {
    [created] = await db.insert(notificationTemplates).values(input).returning();
  } catch (err) {
    // See user-service.ts's createUser for why this must be caught here:
    // Drizzle wraps the real node-postgres error (with raw query text) in
    // `.cause`; `23505` is Postgres's unique_violation SQLSTATE.
    const cause = err instanceof Error ? err.cause : undefined;
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505") {
      const constraint = "constraint" in cause ? cause.constraint : undefined;
      if (constraint === "notification_templates_key_unique") throw new Error("Ya existe una plantilla con esa clave (key).");
      throw new Error("Ya existe una plantilla con esos datos.");
    }
    throw new Error("No se pudo crear la plantilla.");
  }
  if (!created) throw new Error("No se pudo crear la plantilla.");
  return created;
}

export async function getNotificationTemplateByKey(key: string): Promise<NotificationTemplate | undefined> {
  const [row] = await db.select().from(notificationTemplates).where(eq(notificationTemplates.key, key));
  return row;
}

export async function listNotificationTemplates(): Promise<NotificationTemplate[]> {
  return db.select().from(notificationTemplates).orderBy(notificationTemplates.name);
}

/** `{{key}}` placeholders only - not a templating engine dependency. */
function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export async function queueNotification(
  templateKey: string,
  recipientUserId: string,
  context: Record<string, unknown> = {},
): Promise<QueuedNotification> {
  const [created] = await db.insert(queuedNotifications).values({ templateKey, recipientUserId, context }).returning();
  if (!created) throw new Error("Failed to insert queued notification");
  return created;
}

export async function listPendingNotifications(): Promise<QueuedNotification[]> {
  return db.select().from(queuedNotifications).where(eq(queuedNotifications.status, "pending"));
}

/** Renders + sends every pending notification via `transport`, marking each sent/failed. Called by apps/worker. */
export async function dispatchPendingNotifications(transport: NotificationTransport): Promise<{ sent: number; failed: number }> {
  const pending = await listPendingNotifications();
  let sent = 0;
  let failed = 0;

  for (const notification of pending) {
    const template = await getNotificationTemplateByKey(notification.templateKey);
    const recipient = template ? (await db.select().from(users).where(eq(users.id, notification.recipientUserId)))[0] : undefined;

    if (!template || !recipient) {
      await db
        .update(queuedNotifications)
        .set({
          status: "failed",
          errorMessage: !template ? `Template "${notification.templateKey}" not found` : `Recipient ${notification.recipientUserId} not found`,
        })
        .where(eq(queuedNotifications.id, notification.id));
      failed++;
      continue;
    }

    try {
      const context = notification.context as Record<string, unknown>;
      await transport.send({
        to: recipient.email,
        subject: renderTemplate(template.subjectTemplate, context),
        body: renderTemplate(template.bodyTemplate, context),
      });
      await db.update(queuedNotifications).set({ status: "sent", sentAt: new Date() }).where(eq(queuedNotifications.id, notification.id));
      sent++;
    } catch (err) {
      await db
        .update(queuedNotifications)
        .set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err) })
        .where(eq(queuedNotifications.id, notification.id));
      failed++;
    }
  }

  return { sent, failed };
}
