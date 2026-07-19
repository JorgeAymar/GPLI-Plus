import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { dropdownItems } from "./dropdowns";

/**
 * 1:1 extension of `assets`, same shared-PK pattern as `computers`. IP/MAC
 * are plain text for now - a Postgres-native `inet` customType (same
 * approach as `ltree` in entities.ts) is deferred to Phase 6 DCIM, where IP
 * range math actually matters.
 */
export const networkEquipment = pgTable(
  "network_equipment",
  {
    assetId: uuid("asset_id")
      .primaryKey()
      .references(() => assets.id, { onDelete: "cascade" }),
    ipAddress: text("ip_address"),
    macAddress: text("mac_address"),
    deviceTypeDropdownItemId: uuid("device_type_dropdown_item_id").references(() => dropdownItems.id),
    firmwareVersion: text("firmware_version"),
    portsCount: integer("ports_count"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("network_equipment_device_type_dropdown_item_idx").on(table.deviceTypeDropdownItemId)],
);

export type NetworkEquipment = typeof networkEquipment.$inferSelect;
export type NewNetworkEquipment = typeof networkEquipment.$inferInsert;
