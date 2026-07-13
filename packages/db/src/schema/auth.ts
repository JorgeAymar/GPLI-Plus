import { integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Auth.js DrizzleAdapter tables. Session strategy is JWT, not database:
 * Auth.js's Credentials provider (our username/password login) only supports
 * JWT sessions - it has no OAuth account row to persist a DB session against.
 * "Switch active entity/profile without re-login" is instead implemented via
 * the JWT `update()` trigger (see apps/web/lib/auth.ts), so activeEntityId/
 * activeProfileId live in the token, not as columns here. `sessions` stays
 * only so the adapter shape matches Auth.js's expectations for when Phase 6
 * adds OAuth/OIDC providers that may use database sessions.
 */
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export type Session = typeof sessions.$inferSelect;
