import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Unlike password_reset_tokens' 32-byte random token, a 4-digit code has
 * only 10,000 possibilities - hashing it doesn't add real confidentiality
 * (a rainbow table of all 10,000 sha256 hashes is trivial to precompute).
 * The actual protection here is `attempts` (locks the code out after 5
 * wrong guesses) and a short `expiresAt` (10 minutes) - `codeHash` is kept
 * for defense-in-depth/consistency with the rest of the schema, not as the
 * primary control.
 */
export const loginTwoFactorCodes = pgTable(
  "login_two_factor_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("login_two_factor_codes_user_idx").on(table.userId)],
);

export type LoginTwoFactorCode = typeof loginTwoFactorCodes.$inferSelect;
export type NewLoginTwoFactorCode = typeof loginTwoFactorCodes.$inferInsert;
