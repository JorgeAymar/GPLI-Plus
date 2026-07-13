import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";

/**
 * A directed edge in the impact/dependency map: sourceAssetId impacts
 * impactedAssetId (e.g. "if this DB server falls, this app server is
 * affected"). `assets` is already a single unified table, so - unlike GLPI's
 * `glpi_assets_assets` which needs `itemtype_1/items_id_1` +
 * `itemtype_2/items_id_2` to be polymorphic across many item tables - this
 * is a plain FK pair. No unique constraint on the pair: the app can dedupe
 * exact duplicates on write, but it's not load-bearing enough to enforce
 * at the DB level (a second identical edge with a different label is a
 * legitimate use case, e.g. documenting two independent reasons).
 */
export const impactRelations = pgTable(
  "impact_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceAssetId: uuid("source_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    impactedAssetId: uuid("impacted_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    label: text("label"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("impact_relations_source_impacted_idx").on(table.sourceAssetId, table.impactedAssetId),
    index("impact_relations_impacted_idx").on(table.impactedAssetId),
  ],
);

export type ImpactRelation = typeof impactRelations.$inferSelect;
export type NewImpactRelation = typeof impactRelations.$inferInsert;

/**
 * Per-root-asset exploration config for the impact map (currently just how
 * many hops deep to walk). v1 has no visual canvas (Cytoscape-style graph
 * drawing is explicitly out of scope - see impact-service.ts), so unlike
 * GLPI's `glpi_impactitems` there's no `positionsJson`/zoom/color state to
 * persist here; if a canvas view is added later, that's where it'd go.
 */
export const impactContexts = pgTable("impact_contexts", {
  id: uuid("id").primaryKey().defaultRandom(),
  rootAssetId: uuid("root_asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" })
    .unique(),
  maxDepth: integer("max_depth").notNull().default(5),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type ImpactContext = typeof impactContexts.$inferSelect;
export type NewImpactContext = typeof impactContexts.$inferInsert;
