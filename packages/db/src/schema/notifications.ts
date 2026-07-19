import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Simple {{placeholder}} string templates - rendered by notification-service.ts, not a templating engine dependency. */
export const notificationTemplates = pgTable("notification_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  subjectTemplate: text("subject_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed"]);
export type NotificationStatus = (typeof notificationStatusEnum.enumValues)[number];

/** Queue drained by apps/worker's notification-dispatch job - see notification-service.ts dispatchPendingNotifications(). */
export const queuedNotifications = pgTable(
  "queued_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateKey: text("template_key")
      .notNull()
      .references(() => notificationTemplates.key),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id),
    context: jsonb("context").notNull().default({}),
    status: notificationStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { mode: "date" }),
  },
  (table) => [
    index("queued_notifications_recipient_idx").on(table.recipientUserId),
    index("queued_notifications_template_key_idx").on(table.templateKey),
  ],
);

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;
export type QueuedNotification = typeof queuedNotifications.$inferSelect;
export type NewQueuedNotification = typeof queuedNotifications.$inferInsert;
