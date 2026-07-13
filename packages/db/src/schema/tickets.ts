import { jsonb, pgEnum, pgTable } from "drizzle-orm/pg-core";
import { itilBaseColumns } from "./itil-shared";

export const ticketTypeEnum = pgEnum("ticket_type", ["incident", "request"]);
export type TicketType = (typeof ticketTypeEnum.enumValues)[number];

export const tickets = pgTable("tickets", {
  ...itilBaseColumns(),
  ticketType: ticketTypeEnum("ticket_type").notNull().default("incident"),
  // Admin-defined custom fields (see ticket-field-definitions.ts), validated dynamically per ticketType.
  customFields: jsonb("custom_fields").notNull().default({}),
});

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
