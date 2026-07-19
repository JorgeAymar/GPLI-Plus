import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { dropdownCategories } from "./dropdowns";

export const ticketFieldTypeEnum = pgEnum("ticket_field_type", ["text", "textarea", "number", "boolean", "date", "dropdown"]);
export type TicketFieldType = (typeof ticketFieldTypeEnum.enumValues)[number];

/**
 * Admin-defined custom fields for tickets - stored per-instance in tickets.custom_fields (JSONB),
 * validated dynamically (see ticket-field-service.ts). `ticketType` is plain text rather than a
 * reference to tickets.ticketTypeEnum on purpose: it keeps this schema module decoupled from
 * tickets.ts (mirrors how asset-field-definitions.ts stays decoupled from asset instances). NULL
 * means "applies to both incident and request".
 *
 * Known limitation: the unique index below is on (ticketType, key), but Postgres treats every NULL
 * as distinct from every other NULL in a unique index, so two rows with ticketType=NULL and the same
 * key would NOT collide and both inserts would succeed. Accepted as-is rather than worked around with
 * a partial/expression index - out of scope for this pass.
 */
export const ticketFieldDefinitions = pgTable(
  "ticket_field_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketType: text("ticket_type"),
    key: text("key").notNull(),
    label: text("label").notNull(),
    fieldType: ticketFieldTypeEnum("field_type").notNull(),
    dropdownCategoryId: uuid("dropdown_category_id").references(() => dropdownCategories.id),
    isRequired: boolean("is_required").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ticket_field_def_unique_key").on(table.ticketType, table.key),
    index("ticket_field_definitions_dropdown_category_idx").on(table.dropdownCategoryId),
  ],
);

export type TicketFieldDefinition = typeof ticketFieldDefinitions.$inferSelect;
export type NewTicketFieldDefinition = typeof ticketFieldDefinitions.$inferInsert;
