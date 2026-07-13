import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Generic "who else can see this" mechanism, reused by every Fase 5 module that
 * needs restricted visibility (KB articles, RSS feeds, dashboards) instead of
 * replicating GLPI's 4 parallel pivot tables (user/group/profile/entity) per
 * feature. `granteeId` is polymorphic on `granteeKind` and intentionally has no
 * FK - same pattern as `itil_actors.actorId`.
 */
export const visibilityGranteeKindEnum = pgEnum("visibility_grantee_kind", ["user", "group", "profile", "entity"]);
export type VisibilityGranteeKind = (typeof visibilityGranteeKindEnum.enumValues)[number];

export const resourceVisibilityRules = pgTable(
  "resource_visibility_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    granteeKind: visibilityGranteeKindEnum("grantee_kind").notNull(),
    granteeId: uuid("grantee_id").notNull(),
    isRecursive: boolean("is_recursive").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("resource_visibility_lookup_idx").on(table.resourceType, table.resourceId)],
);

export type ResourceVisibilityRule = typeof resourceVisibilityRules.$inferSelect;
export type NewResourceVisibilityRule = typeof resourceVisibilityRules.$inferInsert;
