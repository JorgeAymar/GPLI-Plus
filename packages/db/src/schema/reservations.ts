import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { users } from "./users";

/**
 * Enables a specific asset to be booked by date range (GLPI calls this a
 * "reservable item"). GLPI needs itemtype+items_id because it reserves across
 * N separate tables; here `assetId` is a plain FK since `assets` already
 * unifies every asset type - nothing polymorphic to replicate.
 */
export const reservationItems = pgTable("reservation_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id)
    .unique(),
  comment: text("comment"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * A single booking of a reservationItem over [beginAt, endAt). Rows created
 * together by createRecurringReservations() share the same seriesGroupId;
 * one-off reservations leave it null.
 */
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservationItemId: uuid("reservation_item_id")
      .notNull()
      .references(() => reservationItems.id, { onDelete: "cascade" }),
    beginAt: timestamp("begin_at", { mode: "date" }).notNull(),
    endAt: timestamp("end_at", { mode: "date" }).notNull(),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    comment: text("comment"),
    seriesGroupId: uuid("series_group_id"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("reservations_item_range_idx").on(table.reservationItemId, table.beginAt, table.endAt)],
);

export type ReservationItem = typeof reservationItems.$inferSelect;
export type NewReservationItem = typeof reservationItems.$inferInsert;
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
