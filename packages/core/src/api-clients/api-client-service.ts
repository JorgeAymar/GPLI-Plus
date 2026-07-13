import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { apiClients, db, type ApiClient } from "@itsm/db";

const SALT_ROUNDS = 12;
const RAW_KEY_PREFIX = "sk_";
// "sk_" (3 chars) + 8 hex chars = 11 - long enough to narrow candidates via an
// indexed lookup, short enough to stay cheap to store/scan (Stripe/GitHub pattern).
const PREFIX_LENGTH = 11;

/**
 * Simple bearer-token API client (Stripe-style), not an OAuth2 client.
 *
 * Generates a raw key of the form `sk_<48 hex chars>`, hashes it with bcrypt
 * (same SALT_ROUNDS as packages/core/src/users/user-service.ts) and persists
 * only the hash + a short unhashed prefix for candidate lookup.
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
  const rawKey = RAW_KEY_PREFIX + randomBytes(24).toString("hex");
  const apiKeyHash = await bcrypt.hash(rawKey, SALT_ROUNDS);
  const apiKeyPrefix = rawKey.slice(0, PREFIX_LENGTH);

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
 * Looks up the (few) active clients whose stored prefix matches `rawKey`'s
 * prefix, then bcrypt-compares each candidate - avoids a full-table bcrypt
 * scan while still never comparing raw keys against each other directly.
 * Updates `lastUsedAt` on match. Returns `null` if no active client matches.
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

/** Whether `client` was granted the given MODULE.* scope at creation time. */
export function hasScope(client: ApiClient, moduleKey: string): boolean {
  return client.scopes.includes(moduleKey);
}

export async function listApiClients(entityId: string): Promise<ApiClient[]> {
  return db.select().from(apiClients).where(eq(apiClients.entityId, entityId)).orderBy(apiClients.createdAt);
}

/** Soft-revoke only - never hard-deletes, so `verifyApiKey` keeps failing closed for old keys but audit history survives. */
export async function revokeApiClient(id: string): Promise<ApiClient> {
  const [updated] = await db.update(apiClients).set({ isActive: false }).where(eq(apiClients.id, id)).returning();
  if (!updated) throw new Error(`API client ${id} not found`);
  return updated;
}
