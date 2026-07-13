import { type AnyPgColumn, boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";

/** Generic lookup-table system reused across assets/custom fields instead of dozens of small dedicated tables. */
export const dropdownCategories = pgTable("dropdown_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Items are entity-scoped, not global: an item created at entity E is visible
 * to E and its descendants (see dropdown-service.ts listDropdownItems, which
 * reuses listAncestors()). Creating items at the root entity makes them
 * effectively global.
 */
export const dropdownItems = pgTable(
  "dropdown_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => dropdownCategories.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => dropdownItems.id),
    name: text("name").notNull(),
    comment: text("comment"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("dropdown_items_category_entity_idx").on(table.categoryId, table.entityId)],
);

export type DropdownCategory = typeof dropdownCategories.$inferSelect;
export type NewDropdownCategory = typeof dropdownCategories.$inferInsert;
export type DropdownItem = typeof dropdownItems.$inferSelect;
export type NewDropdownItem = typeof dropdownItems.$inferInsert;
