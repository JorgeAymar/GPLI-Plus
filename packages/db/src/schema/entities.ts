import { type AnyPgColumn, boolean, customType, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Postgres `ltree` has no native Drizzle column type, so it's defined via
 * customType. Materialized path (e.g. "1.4.12") lets subtree/ancestor
 * lookups run as index range scans instead of recursive CTEs.
 */
export const ltree = customType<{ data: string }>({
  dataType() {
    return "ltree";
  },
});

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => entities.id),
    name: text("name").notNull(),
    path: ltree("path").notNull(),
    level: integer("level").notNull().default(0),
    comment: text("comment"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("entities_path_gist_idx").using("gist", table.path), index("entities_parent_idx").on(table.parentId)],
);

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
