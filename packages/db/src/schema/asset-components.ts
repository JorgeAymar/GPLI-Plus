import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";

export const assetComponentTypeEnum = pgEnum("asset_component_type", [
  "cpu",
  "ram",
  "disk",
  "gpu",
  "psu",
  "motherboard",
  "nic",
  "other",
]);
export type AssetComponentType = (typeof assetComponentTypeEnum.enumValues)[number];

/** Sub-parts of a computer (CPU/RAM/disk/...). No independent trash - hard-cascades with the parent asset. */
export const assetComponents = pgTable(
  "asset_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    componentType: assetComponentTypeEnum("component_type").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    capacityValue: integer("capacity_value"),
    capacityUnit: text("capacity_unit"),
    serialNumber: text("serial_number"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("asset_components_asset_idx").on(table.assetId)],
);

export type AssetComponent = typeof assetComponents.$inferSelect;
export type NewAssetComponent = typeof assetComponents.$inferInsert;
