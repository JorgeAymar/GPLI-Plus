import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One row per login attempt (success or failure), keyed by the submitted
 * email - not a user_id FK, since a brute-force attempt against a
 * nonexistent email must still be recorded and rate-limited (otherwise an
 * attacker just probes random emails to dodge the limiter). Rows are cheap
 * and short-lived in practice - only the last RATE_LIMIT_WINDOW_MS matters -
 * but nothing prunes old rows yet; acceptable at this app's scale, worth
 * revisiting if it ever grows large.
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("login_attempts_email_created_idx").on(table.email, table.createdAt)],
);

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type NewLoginAttempt = typeof loginAttempts.$inferInsert;
