import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Visibility is resource-based (resourceType="dashboard") via resource_visibility_rules - see visibility-service.ts, not a column here (same pattern as rss_feeds). */
export const dashboards = pgTable("dashboards", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Cards live on a conceptual grid, not pixels: positionX/positionY/width/height
 * are plain integer grid units (like a 12-column CSS grid), consumed directly
 * by the detail page via `gridColumn: span ${width}` / `gridRow: span ${height}`.
 * No drag-and-drop layout engine (gridstack-style) in v1 - documented recorte,
 * see apps/web/app/(central)/tools/dashboards/[id]/page.tsx.
 */
export const dashboardCards = pgTable("dashboard_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  dashboardId: uuid("dashboard_id")
    .notNull()
    .references(() => dashboards.id, { onDelete: "cascade" }),
  cardKey: text("card_key").notNull(),
  positionX: integer("position_x").notNull().default(0),
  positionY: integer("position_y").notNull().default(0),
  width: integer("width").notNull().default(4),
  height: integer("height").notNull().default(3),
  // Free-form per-card config (e.g. { chartType: "bar" | "pie" | "table" }) - see card-provider.ts.
  options: jsonb("options").notNull().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type Dashboard = typeof dashboards.$inferSelect;
export type NewDashboard = typeof dashboards.$inferInsert;
export type DashboardCard = typeof dashboardCards.$inferSelect;
export type NewDashboardCard = typeof dashboardCards.$inferInsert;
