import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { dropdownItems } from "./dropdowns";
import { entities } from "./entities";
import { ticketTypeEnum } from "./tickets";

/**
 * Predefined request types shown in the self-service portal so end users pick
 * from a curated catalog instead of starting from a blank ticket form.
 * Entity-scoped like dropdownItems/slaPolicies - see service-catalog-service.ts
 * listServiceCatalogItems() for the subtree-visibility rule applied on top of this.
 */
export const serviceCatalogItems = pgTable(
  "service_catalog_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    name: text("name").notNull(),
    description: text("description"),
    ticketType: ticketTypeEnum("ticket_type").notNull().default("request"),
    categoryDropdownItemId: uuid("category_dropdown_item_id").references(() => dropdownItems.id),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("service_catalog_items_entity_idx").on(table.entityId),
    index("service_catalog_items_category_dropdown_item_idx").on(table.categoryDropdownItemId),
  ],
);

export type ServiceCatalogItem = typeof serviceCatalogItems.$inferSelect;
export type NewServiceCatalogItem = typeof serviceCatalogItems.$inferInsert;
