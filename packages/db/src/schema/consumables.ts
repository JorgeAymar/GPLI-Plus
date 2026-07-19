import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { entities } from "./entities";
import { suppliers } from "./suppliers";

export const consumableStatusEnum = pgEnum("consumable_status", ["new", "in_use", "used"]);
export type ConsumableStatus = (typeof consumableStatusEnum.enumValues)[number];

/**
 * The "model"/catalog entry (e.g. "Toner HP 26X"). Physical/replenishable
 * units are tracked individually in `consumables` below - this table only
 * holds the shared metadata (supplier, low-stock threshold, etc).
 */
export const consumableItems = pgTable(
  "consumable_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    name: text("name").notNull(),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    // Below this count of "new" units, the item is considered low-stock. No
    // active alerting system in v1 - just a threshold read by isBelowAlertThreshold().
    alertThreshold: integer("alert_threshold"),
    comment: text("comment"),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("consumable_items_entity_idx").on(table.entityId), index("consumable_items_supplier_idx").on(table.supplierId)],
);

export type ConsumableItem = typeof consumableItems.$inferSelect;
export type NewConsumableItem = typeof consumableItems.$inferInsert;

/** A single physical replenishable unit (e.g. one toner cartridge) belonging to a consumableItem. */
export const consumables = pgTable(
  "consumables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consumableItemId: uuid("consumable_item_id")
      .notNull()
      .references(() => consumableItems.id, { onDelete: "cascade" }),
    status: consumableStatusEnum("status").notNull().default("new"),
    // Asset (e.g. a printer) this unit is assigned to while "in_use".
    assignedAssetId: uuid("assigned_asset_id").references(() => assets.id),
    purchaseDate: timestamp("purchase_date", { mode: "date" }),
    useDate: timestamp("use_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("consumables_item_idx").on(table.consumableItemId), index("consumables_assigned_asset_idx").on(table.assignedAssetId)],
);

export type Consumable = typeof consumables.$inferSelect;
export type NewConsumable = typeof consumables.$inferInsert;
