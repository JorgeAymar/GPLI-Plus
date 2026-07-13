import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { dropdownItems } from "./dropdowns";

/** 1:1 extension of `assets` - shares the asset's own id as PK+FK (table-per-subtype pattern). */
export const computers = pgTable("computers", {
  assetId: uuid("asset_id")
    .primaryKey()
    .references(() => assets.id, { onDelete: "cascade" }),
  osDropdownItemId: uuid("os_dropdown_item_id").references(() => dropdownItems.id),
  osVersionDropdownItemId: uuid("os_version_dropdown_item_id").references(() => dropdownItems.id),
  domain: text("domain"),
  lastBootAt: timestamp("last_boot_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type Computer = typeof computers.$inferSelect;
export type NewComputer = typeof computers.$inferInsert;
