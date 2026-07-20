import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    // Auth.js adapter contract fields (used once OAuth/OIDC providers are added in Phase 6)
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    name: text("name"),
    image: text("image"),
    // Domain fields
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash"),
    displayName: text("display_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    // Opt-in, per user - off by default so existing accounts (and the seeded
    // admin) keep the plain single-step login until they turn it on themselves
    // from /account.
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    defaultEntityId: uuid("default_entity_id").references(() => entities.id),
    language: text("language").notNull().default("es"),
    timezone: text("timezone").notNull().default("UTC"),
    lastLoginAt: timestamp("last_login_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("users_default_entity_idx").on(table.defaultEntityId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
