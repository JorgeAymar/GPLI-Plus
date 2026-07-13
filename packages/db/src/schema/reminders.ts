import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { users } from "./users";

/**
 * Visibility is resource-based (resourceType="reminder") via resource_visibility_rules
 * - see visibility-service.ts, not a column here (same pattern as dashboards/rss_feeds).
 * entityId scopes the reminder to an entity subtree, same pattern as kb_articles -
 * listRemindersVisibleTo() in reminder-service.ts uses it to build the candidate set
 * before narrowing down with isResourceVisibleTo().
 */
export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  title: text("title").notNull(),
  content: text("content"),
  remindAt: timestamp("remind_at", { mode: "date" }),
  isDone: boolean("is_done").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
