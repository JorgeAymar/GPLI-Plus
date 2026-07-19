import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { ticketTypeEnum } from "./tickets";
import { users } from "./users";

/**
 * Fires a new ticket every `intervalMinutes`, using nextRunAt as the
 * watermark - simpler than a full cron parser, sufficient for periodic
 * maintenance-style tickets ("weekly backup check", etc). See
 * recurring-ticket-service.ts runRecurringTicketsSweep().
 */
export const recurringTicketTemplates = pgTable(
  "recurring_ticket_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    name: text("name").notNull(),
    titleTemplate: text("title_template").notNull(),
    contentTemplate: text("content_template").notNull(),
    ticketType: ticketTypeEnum("ticket_type").notNull().default("request"),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id),
    intervalMinutes: integer("interval_minutes").notNull(),
    nextRunAt: timestamp("next_run_at", { mode: "date" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("recurring_ticket_templates_entity_idx").on(table.entityId),
    index("recurring_ticket_templates_requester_idx").on(table.requesterUserId),
  ],
);

export type RecurringTicketTemplate = typeof recurringTicketTemplates.$inferSelect;
export type NewRecurringTicketTemplate = typeof recurringTicketTemplates.$inferInsert;
