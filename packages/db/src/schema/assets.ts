import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { assetDefinitions } from "./asset-definitions";
import { dropdownItems } from "./dropdowns";
import { entities } from "./entities";
import { groups } from "./rbac";
import { users } from "./users";

/**
 * Single polymorphic table for every asset instance, discriminated by
 * assetDefinitionId. Common/searchable columns live here; type-specific
 * structured data lives in extension tables (computers, network_equipment)
 * for the few types that have one, or in customFields for everything else.
 */
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    assetDefinitionId: uuid("asset_definition_id")
      .notNull()
      .references(() => assetDefinitions.id),
    name: text("name").notNull(),
    serialNumber: text("serial_number"),
    inventoryNumber: text("inventory_number"),
    statusDropdownItemId: uuid("status_dropdown_item_id").references(() => dropdownItems.id),
    manufacturerDropdownItemId: uuid("manufacturer_dropdown_item_id").references(() => dropdownItems.id),
    modelDropdownItemId: uuid("model_dropdown_item_id").references(() => dropdownItems.id),
    locationDropdownItemId: uuid("location_dropdown_item_id").references(() => dropdownItems.id),
    userId: uuid("user_id").references(() => users.id),
    groupId: uuid("group_id").references(() => groups.id),
    comment: text("comment"),
    customFields: jsonb("custom_fields").notNull().default({}),
    // Soft-delete (RIGHT.DELETE sets this) vs hard purge (RIGHT.PURGE removes the row).
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("assets_entity_idx").on(table.entityId),
    index("assets_definition_idx").on(table.assetDefinitionId),
    uniqueIndex("assets_inventory_number_unique")
      .on(table.inventoryNumber)
      .where(sql`${table.inventoryNumber} IS NOT NULL`),
  ],
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
