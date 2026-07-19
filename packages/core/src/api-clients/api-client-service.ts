import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { apiClients, db, type ApiClient } from "@itsm/db";
import { SALT_ROUNDS } from "../constants";

const ENTITY_KEY_PREFIX = "sk_";
const PERSONAL_KEY_PREFIX = "pat_";
// "sk_" (3 chars) + 8 hex chars = 11 - long enough to narrow candidates via an
// indexed lookup, short enough to stay cheap to store/scan (Stripe/GitHub
// pattern). "pat_" (4 chars) keeps the same total PREFIX_LENGTH for a uniform
// indexed lookup, one fewer raw hex char captured in the stored prefix -
// harmless, since security comes from the bcrypt hash of the full raw key.
const PREFIX_LENGTH = 11;

async function generateApiKey(prefix: string): Promise<{ rawKey: string; apiKeyHash: string; apiKeyPrefix: string }> {
  const rawKey = prefix + randomBytes(24).toString("hex");
  const apiKeyHash = await bcrypt.hash(rawKey, SALT_ROUNDS);
  const apiKeyPrefix = rawKey.slice(0, PREFIX_LENGTH);
  return { rawKey, apiKeyHash, apiKeyPrefix };
}

/**
 * Simple bearer-token API client (Stripe-style), not an OAuth2 client.
 *
 * IMPORTANT: `rawKey` is returned here and ONLY here. It is never stored in
 * plaintext, so once the caller stops holding onto this return value there is
 * no way to recover or display it again - the client would need to be
 * revoked and a new one created.
 */
export async function createApiClient(input: {
  entityId: string;
  name: string;
  scopes: string[];
}): Promise<{ client: ApiClient; rawKey: string }> {
  const { rawKey, apiKeyHash, apiKeyPrefix } = await generateApiKey(ENTITY_KEY_PREFIX);

  const [created] = await db
    .insert(apiClients)
    .values({
      entityId: input.entityId,
      name: input.name,
      apiKeyHash,
      apiKeyPrefix,
      scopes: input.scopes,
    })
    .returning();
  if (!created) throw new Error("Failed to insert API client");

  return { client: created, rawKey };
}

/**
 * Personal access token: owned by a user (`userId`), not an entity. Used to
 * authenticate the MCP server endpoint (apps/web/app/api/mcp/route.ts) -
 * never valid against /api/v1, which only accepts entity clients (see
 * apps/web/app/api/mcp/route.ts's auth check). `scopes` is left empty;
 * personal tokens are authorized per-call against the owner's real RBAC
 * rights (resolveAuthContext + requireRight), not a fixed scope list.
 */
export async function createPersonalApiClient(input: { userId: string; name: string }): Promise<{ client: ApiClient; rawKey: string }> {
  const { rawKey, apiKeyHash, apiKeyPrefix } = await generateApiKey(PERSONAL_KEY_PREFIX);

  const [created] = await db
    .insert(apiClients)
    .values({
      userId: input.userId,
      name: input.name,
      apiKeyHash,
      apiKeyPrefix,
      scopes: [],
    })
    .returning();
  if (!created) throw new Error("Failed to insert personal API client");

  return { client: created, rawKey };
}

/**
 * Looks up the (few) active clients whose stored prefix matches `rawKey`'s
 * prefix, then bcrypt-compares each candidate - avoids a full-table bcrypt
 * scan while still never comparing raw keys against each other directly.
 * Updates `lastUsedAt` on match. Returns `null` if no active client matches.
 * Works identically for entity and personal clients - callers distinguish by
 * checking `client.userId`.
 */
export async function verifyApiKey(rawKey: string): Promise<ApiClient | null> {
  const prefix = rawKey.slice(0, PREFIX_LENGTH);
  const candidates = await db
    .select()
    .from(apiClients)
    .where(and(eq(apiClients.apiKeyPrefix, prefix), eq(apiClients.isActive, true)));

  for (const candidate of candidates) {
    if (await bcrypt.compare(rawKey, candidate.apiKeyHash)) {
      const [updated] = await db
        .update(apiClients)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiClients.id, candidate.id))
        .returning();
      return updated ?? candidate;
    }
  }

  return null;
}

/** Whether `client` was granted the given MODULE.* scope at creation time. Entity clients only - see createPersonalApiClient's doc comment. */
export function hasScope(client: ApiClient, moduleKey: string): boolean {
  return client.scopes.includes(moduleKey);
}

export async function listApiClients(entityId: string): Promise<ApiClient[]> {
  return db.select().from(apiClients).where(eq(apiClients.entityId, entityId)).orderBy(apiClients.createdAt);
}

export async function listMyApiClients(userId: string): Promise<ApiClient[]> {
  return db.select().from(apiClients).where(eq(apiClients.userId, userId)).orderBy(apiClients.createdAt);
}

/** Soft-revoke only - never hard-deletes, so `verifyApiKey` keeps failing closed for old keys but audit history survives. */
export async function revokeApiClient(id: string): Promise<ApiClient> {
  const [updated] = await db.update(apiClients).set({ isActive: false }).where(eq(apiClients.id, id)).returning();
  if (!updated) throw new Error(`API client ${id} not found`);
  return updated;
}

/**
 * Revokes a personal client only if `userId` actually owns it - prevents one
 * user revoking another's token by guessing its id. Throws (not a bare
 * `false`) on mismatch, matching this file's existing not-found error style.
 */
export async function revokeMyApiClient(id: string, userId: string): Promise<ApiClient> {
  const [client] = await db.select().from(apiClients).where(eq(apiClients.id, id));
  if (!client || client.userId !== userId) {
    throw new Error(`API client ${id} not found`);
  }
  return revokeApiClient(id);
}
