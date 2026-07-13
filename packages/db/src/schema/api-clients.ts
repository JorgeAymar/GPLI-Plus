import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";

/**
 * Bearer-token clients for the public REST API (Stripe/GitHub-style simple
 * bearer token, NOT a full OAuth2 authorization server - see
 * packages/core/src/api-clients/api-client-service.ts for the rationale).
 *
 * `apiKeyPrefix` stores the first ~11 raw characters of the key (e.g.
 * `"sk_a1b2c3d"`) unhashed, so `verifyApiKey()` can narrow candidates with an
 * indexed equality lookup before paying for the expensive `bcrypt.compare()`
 * against `apiKeyHash`. The raw key itself is never persisted anywhere.
 */
export const apiClients = pgTable(
  "api_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    name: text("name").notNull(),
    apiKeyHash: text("api_key_hash").notNull(),
    apiKeyPrefix: text("api_key_prefix").notNull(),
    // Array of MODULE.* string values (see packages/core/src/auth/modules.ts) -
    // the set of item types this client is allowed to read/write via /api/v1.
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("api_clients_entity_idx").on(table.entityId),
    index("api_clients_prefix_idx").on(table.apiKeyPrefix),
  ],
);

export type ApiClient = typeof apiClients.$inferSelect;
export type NewApiClient = typeof apiClients.$inferInsert;
