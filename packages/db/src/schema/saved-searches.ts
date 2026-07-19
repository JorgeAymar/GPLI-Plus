import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { users } from "./users";

export const savedSearchTypeEnum = pgEnum("saved_search_type", ["bookmark", "alert"]);
export type SavedSearchType = (typeof savedSearchTypeEnum.enumValues)[number];

export const savedSearchDoCountEnum = pgEnum("saved_search_do_count", ["no", "yes", "auto"]);
export type SavedSearchDoCount = (typeof savedSearchDoCountEnum.enumValues)[number];

export const savedSearchAlertOperatorEnum = pgEnum("saved_search_alert_operator", ["lt", "lte", "eq", "gt", "gte", "neq"]);
export type SavedSearchAlertOperator = (typeof savedSearchAlertOperatorEnum.enumValues)[number];

/**
 * v1 saved search: this system has no GLPI-style generic search-builder engine,
 * so `queryJson` is stored as an opaque blob rather than a structured/validated
 * query shape. "Running" a saved search means the UI redirects to the matching
 * item-type list page with the JSON pre-loaded (see apps/web tools/saved-searches
 * page) - there is no server-side re-execution of a generic query here.
 */
export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    itemType: text("item_type").notNull(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    isPrivate: boolean("is_private").notNull().default(true),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    isRecursive: boolean("is_recursive").notNull().default(false),
    queryJson: jsonb("query_json").notNull().default({}),
    type: savedSearchTypeEnum("type").notNull().default("bookmark"),
    doCount: savedSearchDoCountEnum("do_count").notNull().default("auto"),
    lastExecutionAt: timestamp("last_execution_at", { mode: "date" }),
    executionCount: integer("execution_count").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("saved_searches_entity_idx").on(table.entityId), index("saved_searches_owner_idx").on(table.ownerUserId)],
);

/** One saved search can only ever have one alert config in v1 (1:1 in practice, modeled as 1:N for room to grow). */
export const savedSearchAlerts = pgTable(
  "saved_search_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    savedSearchId: uuid("saved_search_id")
      .notNull()
      .references(() => savedSearches.id, { onDelete: "cascade" }),
    operator: savedSearchAlertOperatorEnum("operator").notNull(),
    thresholdValue: integer("threshold_value").notNull(),
    frequencyMinutes: integer("frequency_minutes").notNull().default(60),
    isActive: boolean("is_active").notNull().default(true),
    lastCheckedAt: timestamp("last_checked_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("saved_search_alerts_saved_search_idx").on(table.savedSearchId)],
);

export type SavedSearch = typeof savedSearches.$inferSelect;
export type NewSavedSearch = typeof savedSearches.$inferInsert;
export type SavedSearchAlert = typeof savedSearchAlerts.$inferSelect;
export type NewSavedSearchAlert = typeof savedSearchAlerts.$inferInsert;
