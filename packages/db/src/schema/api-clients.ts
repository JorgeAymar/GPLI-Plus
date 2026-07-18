import { boolean, check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { entities } from "./entities";
import { users } from "./users";

/**
 * Bearer-token clients for the public REST API (Stripe/GitHub-style simple
 * bearer token, NOT a full OAuth2 authorization server - see
 * packages/core/src/api-clients/api-client-service.ts for the rationale).
 *
 * Two kinds of client, discriminated by which of `entityId`/`userId` is set
 * (enforced by the `api_clients_entity_xor_user` CHECK below, never both):
 * - Entity clients (`entityId` set, `userId` null): admin-managed via
 *   /setup/api-clients, authorized against `scopes` for the public
 *   /api/v1/<itemtype> REST API.
 * - Personal clients (`userId` set, `entityId` null): self-service via
 *   /account, authorized per-call against the owning user's real RBAC rights
 *   (see resolveAuthContext + requireRight), for the /api/mcp MCP server
 *   endpoint. `scopes` is unused (always `[]`) for this kind.
 *
 * `apiKeyPrefix` stores the first ~11 raw characters of the key (e.g.
 * `"sk_a1b2c3d"` or `"pat_a1b2c3"`) unhashed, so `verifyApiKey()` can narrow
 * candidates with an indexed equality lookup before paying for the expensive
 * `bcrypt.compare()` against `apiKeyHash`. The raw key itself is never
 * persisted anywhere.
 */
export const apiClients = pgTable(
  "api_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").references(() => entities.id),
    userId: uuid("user_id").references(() => users.id),
    name: text("name").notNull(),
    apiKeyHash: text("api_key_hash").notNull(),
    apiKeyPrefix: text("api_key_prefix").notNull(),
    // Array of MODULE.* string values (see packages/core/src/auth/modules.ts) -
    // the set of item types this client is allowed to read/write via /api/v1.
    // Always [] for personal (userId-owned) clients - see class comment.
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("api_clients_entity_idx").on(table.entityId),
    index("api_clients_user_idx").on(table.userId),
    index("api_clients_prefix_idx").on(table.apiKeyPrefix),
    check("api_clients_entity_xor_user", sql`(entity_id IS NOT NULL) != (user_id IS NOT NULL)`),
  ],
);

export type ApiClient = typeof apiClients.$inferSelect;
export type NewApiClient = typeof apiClients.$inferInsert;
