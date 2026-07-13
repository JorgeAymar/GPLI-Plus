import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";

export const webhookEventEnum = pgEnum("webhook_event", ["create", "update", "delete"]);
export type WebhookEvent = (typeof webhookEventEnum.enumValues)[number];

export const queuedWebhookStatusEnum = pgEnum("queued_webhook_status", ["pending", "sent", "failed"]);
export type QueuedWebhookStatus = (typeof queuedWebhookStatusEnum.enumValues)[number];

/**
 * Outbound HTTP subscription: fires an HMAC-signed POST to `url` whenever `itemType`+`event`
 * happens at (or, per webhook-service.ts raiseWebhookEvent(), under) `entityId`. `itemType` is
 * free text (e.g. "ticket", "asset") rather than an FK/enum, mirroring notification_templates.key's
 * convention so new item types never need a migration. See webhook-service.ts.
 */
export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    name: text("name").notNull(),
    itemType: text("item_type").notNull(),
    event: webhookEventEnum("event").notNull(),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    customHeaders: jsonb("custom_headers"),
    isActive: boolean("is_active").notNull().default(true),
    maxRetries: integer("max_retries").notNull().default(3),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("webhooks_entity_idx").on(table.entityId),
    index("webhooks_item_type_event_idx").on(table.itemType, table.event),
  ],
);

/** Queue drained by apps/worker's webhook-dispatch job - see webhook-service.ts dispatchPendingWebhooks(). */
export const queuedWebhooks = pgTable(
  "queued_webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    status: queuedWebhookStatusEnum("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(0),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { mode: "date" }),
  },
  (table) => [
    index("queued_webhooks_webhook_idx").on(table.webhookId),
    index("queued_webhooks_status_next_attempt_idx").on(table.status, table.nextAttemptAt),
  ],
);

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type QueuedWebhook = typeof queuedWebhooks.$inferSelect;
export type NewQueuedWebhook = typeof queuedWebhooks.$inferInsert;
