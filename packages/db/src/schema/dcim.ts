import { index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { dropdownItems } from "./dropdowns";

/**
 * DCIM (Data Center Infrastructure Management): physical placement of assets
 * inside racks/enclosures, cluster membership, and cabling between assets.
 * Racks, enclosures, PDUs and clusters are themselves plain rows in `assets`
 * (via the asset_definitions framework) - these tables only model the
 * relationships between them.
 */
export const rackSlotOrientationEnum = pgEnum("rack_slot_orientation", ["front", "rear"]);
export type RackSlotOrientation = (typeof rackSlotOrientationEnum.enumValues)[number];

/**
 * One row per occupied U position in a rack. No unique constraint on
 * (rackAssetId, positionU, orientation) - overlap of the [positionU,
 * positionU+unitHeight) range is validated in the service layer, same
 * principle as findOverlappingReservation in reservation-service.ts.
 */
export const rackSlots = pgTable(
  "rack_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rackAssetId: uuid("rack_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    occupantAssetId: uuid("occupant_asset_id").references(() => assets.id),
    positionU: integer("position_u").notNull(),
    unitHeight: integer("unit_height").notNull().default(1),
    orientation: rackSlotOrientationEnum("orientation").notNull().default("front"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("rack_slots_rack_orientation_idx").on(table.rackAssetId, table.orientation),
    index("rack_slots_occupant_asset_idx").on(table.occupantAssetId),
  ],
);

export type RackSlot = typeof rackSlots.$inferSelect;
export type NewRackSlot = typeof rackSlots.$inferInsert;

/** One row per occupied slot in a chassis/enclosure (blade servers, line cards, etc). */
export const enclosureSlots = pgTable(
  "enclosure_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enclosureAssetId: uuid("enclosure_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    occupantAssetId: uuid("occupant_asset_id").references(() => assets.id),
    positionSlot: integer("position_slot").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("enclosure_slots_enclosure_asset_idx").on(table.enclosureAssetId),
    index("enclosure_slots_occupant_asset_idx").on(table.occupantAssetId),
  ],
);

export type EnclosureSlot = typeof enclosureSlots.$inferSelect;
export type NewEnclosureSlot = typeof enclosureSlots.$inferInsert;

/** Membership of an asset in a cluster (both are rows in `assets`). Composite PK, same pattern as contract_assets in contracts.ts. */
export const clusterMembers = pgTable(
  "cluster_members",
  {
    clusterAssetId: uuid("cluster_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    memberAssetId: uuid("member_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.clusterAssetId, table.memberAssetId] }),
    index("cluster_members_member_asset_idx").on(table.memberAssetId),
  ],
);

export type ClusterMember = typeof clusterMembers.$inferSelect;
export type NewClusterMember = typeof clusterMembers.$inferInsert;

/** A physical/logical cable connecting two assets (e.g. a switch port to a server NIC, or a PDU to a rack). */
export const cables = pgTable(
  "cables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    endpointAAssetId: uuid("endpoint_a_asset_id")
      .notNull()
      .references(() => assets.id),
    endpointBAssetId: uuid("endpoint_b_asset_id")
      .notNull()
      .references(() => assets.id),
    cableTypeDropdownItemId: uuid("cable_type_dropdown_item_id").references(() => dropdownItems.id),
    comment: text("comment"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("cables_endpoint_a_asset_idx").on(table.endpointAAssetId),
    index("cables_endpoint_b_asset_idx").on(table.endpointBAssetId),
    index("cables_cable_type_dropdown_item_idx").on(table.cableTypeDropdownItemId),
  ],
);

export type Cable = typeof cables.$inferSelect;
export type NewCable = typeof cables.$inferInsert;
