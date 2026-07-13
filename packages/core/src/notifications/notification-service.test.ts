import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db, notificationTemplates, queuedNotifications, users } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser } from "../users/user-service";
import { createNotificationTemplateSchema } from "../validation/notification.zod";
import type { NotificationTransport } from "./transport";
import {
  createNotificationTemplate,
  dispatchPendingNotifications,
  getNotificationTemplateByKey,
  listNotificationTemplates,
  listPendingNotifications,
  queueNotification,
} from "./notification-service";

const PREFIX = "__vitest_platform__";

class RecordingTransport implements NotificationTransport {
  sent: Array<{ to: string; subject: string; body: string }> = [];
  private readonly shouldFail: (to: string) => boolean;

  constructor(shouldFail: (to: string) => boolean = () => false) {
    this.shouldFail = shouldFail;
  }

  async send(input: { to: string; subject: string; body: string }): Promise<void> {
    if (this.shouldFail(input.to)) throw new Error("SMTP down");
    this.sent.push(input);
  }
}

describe("notification-service", () => {
  const templateKey = `${PREFIX}template_${randomUUID().replace(/-/g, "")}`;
  let userId: string;

  beforeAll(async () => {
    const user = await createUser({
      email: `${PREFIX}notif_${randomUUID()}@example.com`,
      username: `${PREFIX}notif_${randomUUID()}`,
      password: "correct-horse-battery-staple",
      displayName: "Notification Test User",
    });
    userId = user.id;

    await createNotificationTemplate({
      key: templateKey,
      name: "Vitest Template",
      subjectTemplate: "Hola {{name}}",
      bodyTemplate: "Cuerpo para {{name}}: {{value}}",
    });
  });

  afterAll(async () => {
    await db.delete(queuedNotifications).where(eq(queuedNotifications.recipientUserId, userId));
    await db.delete(notificationTemplates).where(eq(notificationTemplates.key, templateKey));
    await db.delete(users).where(eq(users.id, userId));
  });

  it("createNotificationTemplate + getNotificationTemplateByKey round-trip", async () => {
    const found = await getNotificationTemplateByKey(templateKey);
    expect(found?.subjectTemplate).toBe("Hola {{name}}");
  });

  it("listNotificationTemplates includes the created template", async () => {
    const all = await listNotificationTemplates();
    expect(all.some((t) => t.key === templateKey)).toBe(true);
  });

  it("queueNotification enqueues a pending row visible via listPendingNotifications", async () => {
    const queued = await queueNotification(templateKey, userId, { name: "Jorge", value: "42" });
    expect(queued.status).toBe("pending");

    const pending = await listPendingNotifications();
    expect(pending.some((n) => n.id === queued.id)).toBe(true);
  });

  it("dispatchPendingNotifications renders the template, sends via transport, and marks the row sent", async () => {
    const queued = await queueNotification(templateKey, userId, { name: "Ada", value: "99" });
    const transport = new RecordingTransport();

    const result = await dispatchPendingNotifications(transport);
    expect(result.sent).toBeGreaterThanOrEqual(1);

    expect(transport.sent.some((m) => m.subject === "Hola Ada" && m.body === "Cuerpo para Ada: 99")).toBe(true);

    const [row] = await db.select().from(queuedNotifications).where(eq(queuedNotifications.id, queued.id));
    expect(row?.status).toBe("sent");
    expect(row?.sentAt).toBeInstanceOf(Date);
  });

  it("dispatchPendingNotifications marks the row failed when the transport throws", async () => {
    const user = await createUser({
      email: `${PREFIX}notif_fail_${randomUUID()}@example.com`,
      username: `${PREFIX}notif_fail_${randomUUID()}`,
      password: "correct-horse-battery-staple",
      displayName: "Notification Failure User",
    });
    try {
      const queued = await queueNotification(templateKey, user.id, { name: "Fails", value: "0" });
      const transport = new RecordingTransport(() => true);

      const result = await dispatchPendingNotifications(transport);
      expect(result.failed).toBeGreaterThanOrEqual(1);

      const [row] = await db.select().from(queuedNotifications).where(eq(queuedNotifications.id, queued.id));
      expect(row?.status).toBe("failed");
      expect(row?.errorMessage).toBe("SMTP down");
    } finally {
      await db.delete(queuedNotifications).where(eq(queuedNotifications.recipientUserId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
  });

  describe("notification zod schema", () => {
    it("createNotificationTemplateSchema enforces a lowercase/underscore key", () => {
      expect(
        createNotificationTemplateSchema.safeParse({
          key: "ticket_solved",
          name: "x",
          subjectTemplate: "s",
          bodyTemplate: "b",
        }).success,
      ).toBe(true);

      expect(
        createNotificationTemplateSchema.safeParse({
          key: "Ticket-Solved",
          name: "x",
          subjectTemplate: "s",
          bodyTemplate: "b",
        }).success,
      ).toBe(false);
    });
  });
});
