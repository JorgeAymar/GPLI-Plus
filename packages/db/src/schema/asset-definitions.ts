import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { dropdownCategories } from "./dropdowns";

export const assetFieldTypeEnum = pgEnum("asset_field_type", ["text", "textarea", "number", "boolean", "date", "dropdown"]);
export type AssetFieldType = (typeof assetFieldTypeEnum.enumValues)[number];

/** A type of asset - both shipped core types (isSystem=true) and admin-created custom types. */
export const assetDefinitions = pgTable("asset_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  icon: text("icon"),
  isSystem: boolean("is_system").notNull().default(false),
  hasExtensionTable: boolean("has_extension_table").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/** Admin-defined custom fields for a type - stored per-instance in assets.custom_fields (JSONB), validated dynamically. */
export const assetFieldDefinitions = pgTable(
  "asset_field_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetDefinitionId: uuid("asset_definition_id")
      .notNull()
      .references(() => assetDefinitions.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    fieldType: assetFieldTypeEnum("field_type").notNull(),
    dropdownCategoryId: uuid("dropdown_category_id").references(() => dropdownCategories.id),
    isRequired: boolean("is_required").notNull().default(false),
    defaultValue: text("default_value"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("asset_field_def_unique_key").on(table.assetDefinitionId, table.key)],
);

export type AssetDefinition = typeof assetDefinitions.$inferSelect;
export type NewAssetDefinition = typeof assetDefinitions.$inferInsert;
export type AssetFieldDefinition = typeof assetFieldDefinitions.$inferSelect;
export type NewAssetFieldDefinition = typeof assetFieldDefinitions.$inferInsert;
