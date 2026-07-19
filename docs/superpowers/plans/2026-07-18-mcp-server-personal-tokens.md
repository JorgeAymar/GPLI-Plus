# Servidor MCP + tokens personales + idioma preferido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any logged-in user create a personal bearer token from a new `/account` ("Mi cuenta") page, and expose a read-only MCP (Model Context Protocol) server endpoint (`/api/mcp`) that authenticates with that token and lets MCP clients (Claude Desktop, Claude Code, etc.) list/read tickets, assets, computers, problems, and changes — scoped to exactly what that user is already allowed to see via the app's existing RBAC. Also adds a language-preference selector to the same page (storage only, no translation engine).

**Architecture:** Extend the existing entity-scoped `api_clients` table with a nullable `userId` (personal tokens) instead of building a parallel system, reusing `createApiClient`/`verifyApiKey`/`revokeApiClient`. The MCP endpoint generates its tools dynamically from the existing `ITEMTYPE_REGISTRY` and authorizes every call through the exact same `resolveAuthContext` + `requireRight` the web UI already uses — no parallel permission system. `/account` mirrors the UI patterns already established by `/setup/api-clients`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Drizzle ORM + PostgreSQL, Zod, `@modelcontextprotocol/sdk` (official MCP TypeScript SDK, v1.29.0 — `McpServer` + `WebStandardStreamableHTTPServerTransport`), Vitest (unit), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-07-18-mcp-server-personal-tokens-design.md`

---

## Task 1: Add the MCP SDK dependency

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install the dependency**

Run: `pnpm --filter @itsm/web add @modelcontextprotocol/sdk@1.29.0`

Expected: `apps/web/package.json` gets a new `"@modelcontextprotocol/sdk": "1.29.0"` line under `"dependencies"`, `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify no duplicate zod install was created**

Run: `pnpm why zod --recursive`

Expected: every package (`@itsm/web`, `@itsm/worker`, `@itsm/core`, and `@modelcontextprotocol/sdk`'s peer) resolves to the **same** single `zod` version (currently `3.25.76`, which satisfies both the repo's declared `^3.24.0` ranges and the SDK's `^3.25 || ^4.0` peer requirement). If you see two different zod versions listed, stop and investigate before continuing — the SDK's Zod-based `inputSchema` won't validate correctly against a mismatched zod instance.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "Add @modelcontextprotocol/sdk dependency for the MCP server endpoint"
```

---

## Task 2: Schema — personal tokens on `api_clients`

**Files:**
- Modify: `packages/db/src/schema/api-clients.ts`
- Create: `packages/db/migrations/00XX_*.sql` (auto-generated, exact name/number decided by drizzle-kit)

- [ ] **Step 1: Update the schema file**

Replace the full contents of `packages/db/src/schema/api-clients.ts`:

```ts
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
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`

Expected: a new file appears under `packages/db/migrations/`, e.g. `0017_<random-name>.sql`, containing `ALTER TABLE "api_clients" ALTER COLUMN "entity_id" DROP NOT NULL;`, `ALTER TABLE "api_clients" ADD COLUMN "user_id" uuid;`, the two new `CREATE INDEX` statements, the `ADD CONSTRAINT ... CHECK (...)`, and an `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ("user_id") REFERENCES "users"("id")`. Read the generated file before applying it - confirm it does NOT drop or rewrite any existing column/data (only additive + one nullability relax).

- [ ] **Step 3: Apply the migration**

Run: `pnpm db:migrate`

Expected: `[✓] migrations applied successfully!` printed, no errors. If it fails on the CHECK constraint, some existing row already violates it (shouldn't happen - every current `api_clients` row has `entityId` set and `userId` null) - investigate with `docker exec glpi-plus-postgres-1 psql -U itsm -d itsm -c "select id, entity_id, user_id from api_clients;"` before retrying.

- [ ] **Step 4: Verify existing behavior still works**

Run: `docker exec glpi-plus-postgres-1 psql -U itsm -d itsm -c "\d api_clients"`

Expected: `entity_id` column shows nullable, `user_id` column present and nullable, both indexes and the check constraint listed.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/api-clients.ts packages/db/migrations/
git commit -m "Add nullable userId + CHECK constraint to api_clients for personal tokens"
```

---

## Task 3: Core — `createPersonalApiClient` + `listMyApiClients` + `revokeMyApiClient`

**Files:**
- Modify: `packages/core/src/validation/api-client.zod.ts`
- Modify: `packages/core/src/api-clients/api-client-service.ts`
- Modify: `packages/core/src/api-clients/api-client-service.test.ts`

- [ ] **Step 1: Add the validation schema**

In `packages/core/src/validation/api-client.zod.ts`, add below the existing `createApiClientSchema`:

```ts
export const createPersonalApiClientSchema = z.object({
  name: z.string().min(1).max(255),
});
export type CreatePersonalApiClientInput = z.infer<typeof createPersonalApiClientSchema>;
```

- [ ] **Step 2: Write the failing tests**

Add to `packages/core/src/api-clients/api-client-service.test.ts`, inside the existing top-level `describe("api-client-service", ...)` block (after the last `it(...)` for `listApiClients`, before the `describe("createApiClientSchema (zod)", ...)` block). First add a user fixture alongside the existing entity fixture:

```ts
import { createUser } from "../users/user-service";
```

(add this import at the top, next to the existing `createEntity` import)

```ts
describe("personal (userId-owned) API clients", () => {
  let userId: string;

  beforeAll(async () => {
    const user = await createUser({
      email: `${PREFIX}_personal@example.com`,
      username: `${PREFIX}_personal`,
      password: "irrelevant-not-used-here-1234",
      displayName: "Personal Token Owner",
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId));
  });

  it("createPersonalApiClient sets userId, leaves entityId null, and uses the pat_ prefix", async () => {
    const { client, rawKey } = await createPersonalApiClient({ userId, name: `${PREFIX}_personal_client` });

    expect(rawKey.startsWith("pat_")).toBe(true);
    expect(client.userId).toBe(userId);
    expect(client.entityId).toBeNull();
    expect(client.scopes).toEqual([]);
    expect(client.apiKeyHash).not.toBe(rawKey);
  });

  it("verifyApiKey works the same way for personal clients as for entity clients", async () => {
    const { rawKey } = await createPersonalApiClient({ userId, name: `${PREFIX}_personal_verify` });
    const verified = await verifyApiKey(rawKey);
    expect(verified?.userId).toBe(userId);
  });

  it("listMyApiClients only returns the given user's own clients", async () => {
    const otherUser = await createUser({
      email: `${PREFIX}_personal_other@example.com`,
      username: `${PREFIX}_personal_other`,
      password: "irrelevant-not-used-here-1234",
      displayName: "Other User",
    });
    try {
      await createPersonalApiClient({ userId: otherUser.id, name: `${PREFIX}_other_users_client` });
      const mine = await listMyApiClients(userId);
      expect(mine.every((c) => c.userId === userId)).toBe(true);
      expect(mine.some((c) => c.name === `${PREFIX}_other_users_client`)).toBe(false);
    } finally {
      await db.delete(users).where(eq(users.id, otherUser.id));
    }
  });

  it("revokeMyApiClient revokes when the caller owns the client", async () => {
    const { client } = await createPersonalApiClient({ userId, name: `${PREFIX}_personal_revoke_ok` });
    const revoked = await revokeMyApiClient(client.id, userId);
    expect(revoked.isActive).toBe(false);
  });

  it("revokeMyApiClient throws when the caller does not own the client", async () => {
    const { client } = await createPersonalApiClient({ userId, name: `${PREFIX}_personal_revoke_denied` });
    await expect(revokeMyApiClient(client.id, "00000000-0000-0000-0000-000000000000")).rejects.toThrow();

    const stillActive = await verifyApiKey((await createPersonalApiClient({ userId, name: `${PREFIX}_x` })).rawKey);
    expect(stillActive).not.toBeNull(); // sanity: revokeApiClient itself still works elsewhere
  });
});
```

Also update the top of the test file's imports to include the new functions and `users` table:

```ts
import { apiClients, db, entities, users } from "@itsm/db";
```

```ts
import { createApiClient, createPersonalApiClient, hasScope, listApiClients, listMyApiClients, revokeApiClient, revokeMyApiClient, verifyApiKey } from "./api-client-service";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/core && npx vitest run api-clients/api-client-service.test.ts`

Expected: FAIL — `createPersonalApiClient`, `listMyApiClients`, `revokeMyApiClient` are not exported yet (TypeScript/import error or `is not a function`).

- [ ] **Step 3: Implement in the service**

Replace the full contents of `packages/core/src/api-clients/api-client-service.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/core && npx vitest run api-clients/api-client-service.test.ts`

Expected: all tests pass, including the pre-existing ones (this step is a refactor of `createApiClient`'s internals - `generateApiKey` extraction - so re-running the full file also guards against a regression there).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/validation/api-client.zod.ts packages/core/src/api-clients/api-client-service.ts packages/core/src/api-clients/api-client-service.test.ts
git commit -m "Add personal (userId-owned) API clients: create, list, ownership-checked revoke"
```

---

## Task 4: Core — preferred language

**Files:**
- Modify: `packages/core/src/validation/user.zod.ts`
- Modify: `packages/core/src/users/user-service.ts`
- Create: `packages/core/src/users/user-service.test.ts`

- [ ] **Step 1: Add `SUPPORTED_LANGUAGES` + schema**

In `packages/core/src/validation/user.zod.ts`, add at the end:

```ts
/**
 * Single source of truth for language codes - both the Zod enum below and
 * the <select> in apps/web/app/(central)/account/language-form.tsx read from
 * this, so they can't drift out of sync.
 */
export const SUPPORTED_LANGUAGES = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
  { code: "pt", name: "Português" },
  { code: "fr", name: "Français" },
  { code: "it", name: "Italiano" },
  { code: "de", name: "Deutsch" },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code) as [SupportedLanguageCode, ...SupportedLanguageCode[]];

export const updateLanguageSchema = z.object({
  language: z.enum(LANGUAGE_CODES),
});
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/src/users/user-service.test.ts`:

```ts
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db, users } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createUser, updateUserLanguage } from "./user-service";

const PREFIX = "__vitest_user_service__";

describe("user-service", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it("createUser defaults language to 'es'", async () => {
    const user = await createUser({
      email: `${PREFIX}_${randomUUID()}@example.com`,
      username: `${PREFIX}_${randomUUID().slice(0, 8)}`,
      password: "irrelevant-not-used-here-1234",
      displayName: "Default Language User",
    });
    createdUserIds.push(user.id);
    expect(user.language).toBe("es");
  });

  it("updateUserLanguage updates the stored language", async () => {
    const user = await createUser({
      email: `${PREFIX}_${randomUUID()}@example.com`,
      username: `${PREFIX}_${randomUUID().slice(0, 8)}`,
      password: "irrelevant-not-used-here-1234",
      displayName: "Language Update User",
    });
    createdUserIds.push(user.id);

    const updated = await updateUserLanguage(user.id, "fr");
    expect(updated.language).toBe("fr");

    const [reloaded] = await db.select().from(users).where(eq(users.id, user.id));
    expect(reloaded?.language).toBe("fr");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/core && npx vitest run users/user-service.test.ts`

Expected: FAIL — `updateUserLanguage` is not exported yet.

- [ ] **Step 4: Implement `updateUserLanguage`**

In `packages/core/src/users/user-service.ts`, add at the end of the file:

```ts
/** Validate `language` with `updateLanguageSchema` (packages/core/src/validation/user.zod.ts) before calling this - this function trusts its input, matching every other *-service.ts in this package. */
export async function updateUserLanguage(userId: string, language: string): Promise<User> {
  const [updated] = await db.update(users).set({ language }).where(eq(users.id, userId)).returning();
  if (!updated) throw new Error(`User ${userId} not found`);
  return updated;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/core && npx vitest run users/user-service.test.ts`

Expected: PASS, 2/2.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/validation/user.zod.ts packages/core/src/users/user-service.ts packages/core/src/users/user-service.test.ts
git commit -m "Add preferred-language storage (SUPPORTED_LANGUAGES + updateUserLanguage)"
```

---

## Task 5: apps/web — `/account` server actions

**Files:**
- Create: `apps/web/actions/account.actions.ts`

- [ ] **Step 1: Write the actions**

Create `apps/web/actions/account.actions.ts`:

```ts
"use server";

import { requireAuthContext } from "@/lib/session";
import {
  createPersonalApiClient,
  createPersonalApiClientSchema,
  listMyApiClients,
  revokeMyApiClient,
  updateLanguageSchema,
  updateUserLanguage,
} from "@itsm/core";
import type { ApiClient, User } from "@itsm/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * `schema.parse()` throws a `ZodError` whose `.message` getter is a JSON blob
 * (see zod's ZodError#message), not a human-readable string - same reasoning
 * as the identical helper in apps/web/actions/api-clients.actions.ts. Use
 * `.safeParse` and rethrow a clean, semicolon-joined message so forms can
 * surface `err.message` directly.
 */
function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

export async function listMyApiClientsAction(): Promise<ApiClient[]> {
  const context = await requireAuthContext();
  return listMyApiClients(context.user.id);
}

/**
 * Returns `rawKey` alongside the created client so the page can show it once
 * (see createPersonalApiClient's doc comment - it is never recoverable after
 * this call). No `requireRight` check: creating your own personal token is
 * self-service, not an RBAC-gated action - any authenticated user manages
 * their own MCP access.
 */
export async function createMyApiClientAction(input: unknown): Promise<{ client: ApiClient; rawKey: string }> {
  const context = await requireAuthContext();
  const parsed = parseInput(createPersonalApiClientSchema, input);
  const result = await createPersonalApiClient({ userId: context.user.id, name: parsed.name });
  revalidatePath("/account");
  return result;
}

export async function revokeMyApiClientAction(id: string): Promise<ApiClient> {
  const context = await requireAuthContext();
  const client = await revokeMyApiClient(id, context.user.id);
  revalidatePath("/account");
  return client;
}

export async function updateMyLanguageAction(input: unknown): Promise<User> {
  const context = await requireAuthContext();
  const parsed = parseInput(updateLanguageSchema, input);
  const user = await updateUserLanguage(context.user.id, parsed.language);
  revalidatePath("/account");
  return user;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/actions/account.actions.ts
git commit -m "Add server actions for /account: personal tokens + language preference"
```

---

## Task 6: apps/web — `/account` page + components

**Files:**
- Create: `apps/web/app/(central)/account/page.tsx`
- Create: `apps/web/app/(central)/account/token-form.tsx`
- Create: `apps/web/app/(central)/account/revoke-token-button.tsx`
- Create: `apps/web/app/(central)/account/language-form.tsx`
- Modify: `apps/web/components/layout/nav-sidebar.tsx`

- [ ] **Step 1: Create the token creation form**

Create `apps/web/app/(central)/account/token-form.tsx`:

```tsx
"use client";

import { createMyApiClientAction } from "@/actions/account.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
  rawKey?: string;
  clientName?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    const name = formData.get("name") as string;
    const result = await createMyApiClientAction({ name });
    return { rawKey: result.rawKey, clientName: result.client.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function TokenForm() {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <div className="space-y-4">
      {state?.rawKey ? (
        <div className="space-y-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            Token &quot;{state.clientName}&quot; creado. Copiá esta key ahora — no se puede volver a mostrar.
          </p>
          <pre className="overflow-x-auto rounded bg-black/80 p-2 text-xs text-green-400">{state.rawKey}</pre>
        </div>
      ) : null}

      <form action={formAction} className="space-y-3">
        <div>
          <label htmlFor="token-name" className="text-sm font-medium">Nombre</label>
          <input id="token-name" name="name" required placeholder="claude-desktop" className={inputClass} />
        </div>
        {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {isPending ? "Creando..." : "Crear token"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create the revoke button**

Create `apps/web/app/(central)/account/revoke-token-button.tsx`:

```tsx
"use client";

import { revokeMyApiClientAction } from "@/actions/account.actions";
import { useActionState } from "react";

interface RevokeState {
  error?: string;
}

async function action(_prev: RevokeState | undefined, formData: FormData): Promise<RevokeState> {
  try {
    await revokeMyApiClientAction(formData.get("id") as string);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function RevokeTokenButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {isPending ? "Revocando..." : "Revocar"}
      </button>
      {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
```

- [ ] **Step 3: Create the language form**

Create `apps/web/app/(central)/account/language-form.tsx`:

```tsx
"use client";

import { updateMyLanguageAction } from "@/actions/account.actions";
import type { SUPPORTED_LANGUAGES } from "@itsm/core";
import { useActionState } from "react";

interface FormState {
  error?: string;
  saved?: boolean;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    const language = formData.get("language") as string;
    await updateMyLanguageAction({ language });
    return { saved: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function LanguageForm({
  currentLanguage,
  options,
}: {
  currentLanguage: string;
  options: typeof SUPPORTED_LANGUAGES;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <select
        name="language"
        defaultValue={currentLanguage}
        className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
      >
        {options.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar"}
      </button>
      {state?.saved ? <span className="text-sm text-green-700 dark:text-green-400">Guardado.</span> : null}
      {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
    </form>
  );
}
```

- [ ] **Step 4: Create the page**

Create `apps/web/app/(central)/account/page.tsx`:

```tsx
import { requireAuthContext } from "@/lib/session";
import { listMyApiClients, SUPPORTED_LANGUAGES } from "@itsm/core";
import { LanguageForm } from "./language-form";
import { RevokeTokenButton } from "./revoke-token-button";
import { TokenForm } from "./token-form";

export default async function AccountPage() {
  const context = await requireAuthContext();
  const tokens = await listMyApiClients(context.user.id);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Mi cuenta</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium opacity-70">Datos</h2>
        <dl className="grid max-w-md grid-cols-2 gap-y-1 text-sm">
          <dt className="opacity-60">Nombre</dt>
          <dd>{context.user.displayName}</dd>
          <dt className="opacity-60">Email</dt>
          <dd>{context.user.email}</dd>
          <dt className="opacity-60">Entidad activa</dt>
          <dd>{context.activeEntity.name}</dd>
          <dt className="opacity-60">Perfil activo</dt>
          <dd>{context.activeProfile.name}</dd>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium opacity-70">Idioma</h2>
        <LanguageForm currentLanguage={context.user.language} options={SUPPORTED_LANGUAGES} />
        <p className="max-w-md text-xs opacity-50">
          Esto solo guarda tu preferencia. Todavía no cambia el idioma de la interfaz.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium opacity-70">Tokens MCP</h2>
        <p className="max-w-2xl text-sm opacity-70">
          Tokens personales para conectar clientes MCP (Claude Desktop, Claude Code, etc.) contra{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">/api/mcp</code>. Actúan con tus mismos permisos —
          solo lectura por ahora.
        </p>

        <div className="grid grid-cols-2 gap-8">
          <div className="min-w-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left opacity-60">
                    <th className="pb-2">Nombre</th>
                    <th className="pb-2">Prefijo</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2">Último uso</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => (
                    <tr key={t.id} className="border-t border-black/5 dark:border-white/5">
                      <td className="py-2">{t.name}</td>
                      <td className="py-2 font-mono opacity-70">{t.apiKeyPrefix}…</td>
                      <td className="py-2">
                        {t.isActive ? (
                          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-700 dark:text-green-400">
                            Activo
                          </span>
                        ) : (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-700 dark:text-red-400">
                            Revocado
                          </span>
                        )}
                      </td>
                      <td className="py-2 whitespace-nowrap opacity-70">{t.lastUsedAt ? t.lastUsedAt.toLocaleString() : "Nunca"}</td>
                      <td className="py-2">{t.isActive ? <RevokeTokenButton id={t.id} /> : null}</td>
                    </tr>
                  ))}
                  {tokens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-2 opacity-50">
                        Sin tokens todavía.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <TokenForm />
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Add the nav link**

In `apps/web/components/layout/nav-sidebar.tsx`, change:

```ts
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { label: "Asistencia", section: true },
```

to:

```ts
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/account", label: "Mi cuenta" },
  { label: "Asistencia", section: true },
```

- [ ] **Step 6: Manually verify in the browser**

With the dev server running (`npm run dev`), log in as `admin@itsm.local` / `ChangeMe123!`, click "Mi cuenta" in the sidebar, confirm: the page loads with your name/email/entity/profile, the language selector shows "Español" selected, changing it to another option and clicking "Guardar" shows "Guardado.", creating a token shows the `pat_...` key once, and it appears in the table; revoking it flips it to "Revocado" and hides the button.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(central\)/account apps/web/components/layout/nav-sidebar.tsx
git commit -m "Add /account page: personal token management + language selector"
```

---

## Task 7: apps/web — MCP server endpoint

**Files:**
- Create: `apps/web/app/api/mcp/route.ts`

- [ ] **Step 1: Write the route handler**

Create `apps/web/app/api/mcp/route.ts`:

```ts
import { ITEMTYPE_REGISTRY, RIGHT, requireRight, resolveAuthContext, verifyApiKey } from "@itsm/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

/**
 * Remote MCP server endpoint - read-only tools generated from
 * ITEMTYPE_REGISTRY (packages/core/src/api-clients/itemtype-registry.ts),
 * one list_<key>/get_<key> pair per registered item type. Adding an entry to
 * that registry makes it show up here automatically - no tool is hardcoded
 * per item type.
 *
 * Auth: a personal access token (api_clients.userId set - see
 * packages/core/src/api-clients/api-client-service.ts::createPersonalApiClient).
 * An entity-level token (the /api/v1 kind) is explicitly rejected - the two
 * token kinds are not interchangeable.
 *
 * Stateless: no sessionIdGenerator, since every tool call re-resolves the
 * caller's AuthContext fresh (matching how a page render or Server Action
 * already does) - there is no server-held state to preserve between calls.
 *
 * Known limitation inherited from /api/v1/[itemtype]/[id]/route.ts: `get_<key>`
 * looks up by id without verifying the item's entity is within the caller's
 * entity subtree (the registry's `get?(id)` signature has no entityId
 * parameter to check against). Same gap as the existing public REST API,
 * not introduced here - flagged so a future fix covers both call sites.
 */

function buildServer(userId: string): McpServer {
  const server = new McpServer({ name: "itsm-platform", version: "1.0.0" });

  for (const [key, entry] of Object.entries(ITEMTYPE_REGISTRY)) {
    server.registerTool(`list_${key}`, { description: `Lista los "${key}" de tu entidad activa (incluye subárbol).` }, async () => {
      const context = await resolveAuthContext({ userId, activeEntityId: null, activeProfileId: null });
      if (!context) {
        return { content: [{ type: "text" as const, text: "Tu usuario ya no está activo." }], isError: true };
      }
      try {
        await requireRight(context, entry.moduleKey, RIGHT.READ);
      } catch (err) {
        return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : "Sin permiso" }], isError: true };
      }
      const items = await entry.list(context.activeEntity.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(items) }] };
    });

    if (entry.get) {
      const get = entry.get;
      server.registerTool(
        `get_${key}`,
        {
          description: `Obtiene un "${key.replace(/s$/, "")}" por id.`,
          inputSchema: { id: z.string().uuid() },
        },
        async ({ id }) => {
          const context = await resolveAuthContext({ userId, activeEntityId: null, activeProfileId: null });
          if (!context) {
            return { content: [{ type: "text" as const, text: "Tu usuario ya no está activo." }], isError: true };
          }
          try {
            await requireRight(context, entry.moduleKey, RIGHT.READ);
          } catch (err) {
            return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : "Sin permiso" }], isError: true };
          }
          const item = await get(id);
          if (!item) {
            return { content: [{ type: "text" as const, text: `No se encontró "${key}" con id ${id}.` }], isError: true };
          }
          return { content: [{ type: "text" as const, text: JSON.stringify(item) }] };
        },
      );
    }
  }

  return server;
}

async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("authorization") ?? "";
  const [scheme, rawKey] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !rawKey) {
    return Response.json({ error: "Missing or malformed Authorization header. Expected: Bearer <token>" }, { status: 401 });
  }

  const client = await verifyApiKey(rawKey);
  if (!client) {
    return Response.json({ error: "Invalid or revoked token" }, { status: 401 });
  }
  if (!client.userId) {
    return Response.json(
      { error: "Este token es de entidad, no personal. Los tokens MCP se crean desde /account." },
      { status: 401 },
    );
  }
  return { userId: client.userId };
}

async function handleMcpRequest(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  const server = buildServer(authResult.userId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function GET(req: Request) {
  return handleMcpRequest(req);
}

export async function POST(req: Request) {
  return handleMcpRequest(req);
}

export async function DELETE(req: Request) {
  return handleMcpRequest(req);
}
```

- [ ] **Step 2: Confirm this route is excluded from the human-session proxy**

Read `apps/web/proxy.ts`'s `matcher` - it is `["/((?!api|_next/static|_next/image|favicon.ico).*)"]`, which already excludes all of `/api/**`. No change needed. Confirm by checking the file, not by assuming.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/mcp
git commit -m "Add /api/mcp: read-only MCP server endpoint over ITEMTYPE_REGISTRY"
```

---

## Task 8: Integration test — real MCP client against the live endpoint

**Files:**
- Create: `apps/web/app/api/mcp/mcp-route.integration.test.ts`

This exercises the endpoint the way a real MCP client (Claude Desktop, Claude Code) would — over real HTTP, using the MCP SDK's own client, against the actual running dev server. It requires `npm run dev` to already be running on `http://localhost:3210` (same precondition as the Playwright e2e suite) and a seeded admin user (`admin@itsm.local` / `ChangeMe123!`, from `packages/core/scripts/seed.ts`).

- [ ] **Step 1: Write the test**

Create `apps/web/app/api/mcp/mcp-route.integration.test.ts`. Note it creates its personal/entity tokens directly through `@itsm/core`/`@itsm/db` (this file lives in `apps/web`, which already depends on both) rather than logging in over HTTP first - a Next.js Server Action isn't callable from outside a browser without reimplementing its undocumented internal wire protocol, and test setup doesn't need to go through the UI when the thing actually under test is the `/api/mcp` HTTP endpoint itself:

```ts
import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApiClient, createPersonalApiClient, findUserByEmail } from "@itsm/core";
import { apiClients, db } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3210";
const PREFIX = "__vitest_mcp_route__";

describe("MCP route integration (requires `npm run dev` running)", () => {
  let personalRawKey: string;
  let entityRawKey: string;
  const createdClientIds: string[] = [];

  beforeAll(async () => {
    const admin = await findUserByEmail(process.env.E2E_ADMIN_EMAIL ?? "admin@itsm.local");
    if (!admin) throw new Error("Seed the DB first: pnpm db:migrate && cd packages/core && npx tsx scripts/seed.ts");

    const personal = await createPersonalApiClient({ userId: admin.id, name: `${PREFIX}_personal` });
    personalRawKey = personal.rawKey;
    createdClientIds.push(personal.client.id);

    // An entity-level token, to confirm the MCP endpoint rejects it (see authenticate() in route.ts).
    const entity = await createApiClient({ entityId: admin.defaultEntityId!, name: `${PREFIX}_entity`, scopes: ["assistance.ticket"] });
    entityRawKey = entity.rawKey;
    createdClientIds.push(entity.client.id);
  });

  afterAll(async () => {
    for (const id of createdClientIds) {
      await db.delete(apiClients).where(eq(apiClients.id, id));
    }
  });

  it("rejects a request with no Authorization header", async () => {
    const res = await fetch(`${BASE_URL}/api/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(401);
  });

  it("rejects an entity-level (non-personal) token", async () => {
    const res = await fetch(`${BASE_URL}/api/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${entityRawKey}` },
      body: "{}",
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/entidad, no personal/);
  });

  it("rejects a personal (non-entity) token on the entity-only /api/v1 REST API - the symmetric check", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/tickets`, {
      headers: { authorization: `Bearer ${personalRawKey}` },
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/personal access token/);
  });

  it("lists tools and successfully calls list_tickets with a valid personal token", async () => {
    const client = new Client({ name: "vitest-mcp-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${BASE_URL}/api/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${personalRawKey}` } },
    });
    await client.connect(transport);

    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("list_tickets");
    expect(toolNames).toContain("get_tickets"); // ITEMTYPE_REGISTRY keys are plural, so get_<key> is too
    expect(toolNames).toContain("list_assets");
    expect(toolNames).toContain("list_computers");
    expect(toolNames).toContain("list_problems");
    expect(toolNames).toContain("list_changes");
    expect(toolNames.length).toBe(10); // 5 itemtypes x (list + get), all 5 have `get`

    const result = await client.callTool({ name: "list_tickets", arguments: {} });
    expect(result.isError).not.toBe(true);
    const text = (result.content as Array<{ type: string; text?: string }>)[0]?.text ?? "[]";
    expect(() => JSON.parse(text)).not.toThrow();

    await client.close();
  });
});
```

- [ ] **Step 2: Add a script to run it**

In `apps/web/package.json`, add a script next to `"test"`:

```json
    "test:mcp-integration": "vitest run app/api/mcp/mcp-route.integration.test.ts",
```

- [ ] **Step 3: Run it against the live dev server**

With `npm run dev` running (and the DB seeded), run: `cd apps/web && npm run test:mcp-integration`

Expected: all 4 tests pass. If "rejects an entity-level token" fails with a 500 instead of 401, re-check `admin.defaultEntityId` is actually set on the seeded admin (`packages/core/scripts/seed.ts` sets this) before debugging the route itself.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/mcp/mcp-route.integration.test.ts apps/web/package.json
git commit -m "Add MCP route integration test using the real MCP client SDK"
```

---

## Task 9: E2E — `/account` page

**Files:**
- Create: `e2e/specs/account.spec.ts`

- [ ] **Step 1: Write the spec**

Create `e2e/specs/account.spec.ts`, following the same `diagnostics(page)` helper pattern already used in `e2e/specs/setup.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for /account: personal MCP tokens (create/list/revoke) and the
 * language preference selector. All specs run authenticated as admin (see
 * e2e/auth.setup.ts + playwright.config.ts).
 */

interface Diagnostics {
  consoleErrors: string[];
  requestErrors: string[];
  assertClean(): void;
}

function diagnostics(page: Page): Diagnostics {
  const consoleErrors: string[] = [];
  const requestErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" && !/^Failed to load resource:/.test(msg.text())) consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/_next/") || url.endsWith("/favicon.ico")) return;
    if (response.status() >= 400) requestErrors.push(`${response.status()} ${url}`);
  });

  return {
    consoleErrors,
    requestErrors,
    assertClean() {
      expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
      expect(requestErrors, `network errors:\n${requestErrors.join("\n")}`).toEqual([]);
    },
  };
}

function uniqueTitle(prefix: string): string {
  return `E2E-${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

test.describe("Mi cuenta (/account)", () => {
  test("la página carga con datos del usuario, selector de idioma y form de tokens", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/account");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
    await expect(page.locator("select[name=\"language\"]")).toHaveValue("es");
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear token" })).toBeVisible();

    diag.assertClean();
  });

  test("cambiar el idioma persiste tras recargar", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/account");

    await page.locator('select[name="language"]').selectOption("fr");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado.")).toBeVisible();

    await page.reload();
    await expect(page.locator('select[name="language"]')).toHaveValue("fr");

    // Reset so other tests/manual QA see the default again.
    await page.locator('select[name="language"]').selectOption("es");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado.")).toBeVisible();

    diag.assertClean();
  });

  test("crear un token MCP lo revela una vez y lo lista; revocar lo marca como Revocado", async ({ page }) => {
    const diag = diagnostics(page);
    const name = uniqueTitle("ACCOUNT-TOKEN");

    await page.goto("/account");
    await page.locator('input[name="name"]').fill(name);
    await page.getByRole("button", { name: "Crear token" }).click();

    const keyBlock = page.locator("pre");
    await expect(keyBlock).toBeVisible();
    const rawKey = (await keyBlock.textContent())?.trim() ?? "";
    expect(rawKey).toMatch(/^pat_[0-9a-f]{40,48}$/);

    const row = page.locator("tbody tr", { hasText: name });
    await expect(row).toContainText("Activo");

    await row.getByRole("button", { name: "Revocar" }).click();
    await page.waitForLoadState("networkidle");
    await expect(row).toContainText("Revocado", { timeout: 10_000 });
    await expect(row.getByRole("button", { name: "Revocar" })).toHaveCount(0);

    diag.assertClean();
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/specs/account.spec.ts`

Expected: 3/3 pass.

- [ ] **Step 3: Run the full e2e suite to confirm no regressions**

Run: `npm run e2e`

Expected: all tests pass (previous count + 3 new = the running total; no failures elsewhere).

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/account.spec.ts
git commit -m "Add e2e coverage for /account: tokens lifecycle + language persistence"
```

---

## Task 10: Update architecture docs

**Files:**
- Modify: `docs/architecture-plan.md`

- [ ] **Step 1: Add a summary paragraph**

Following this doc's existing convention (see the "Fase 4a", "Fase 5a" etc. paragraphs), append a new paragraph documenting: personal (`userId`-owned) `api_clients` alongside the existing entity-owned kind, the `/account` page, the `/api/mcp` endpoint and its tool-generation-from-registry approach, and the `users.language` field now being wired to a selector (with the i18n engine itself still not built - link back to the spec file for the full writeup).

- [ ] **Step 2: Commit**

```bash
git add docs/architecture-plan.md
git commit -m "Document the MCP server + personal tokens + language preference feature"
```

---

## Self-Review Notes (already applied above)

- **Spec coverage:** Sections A (schema) → Task 2; B (authz) → Task 7; C (endpoint) → Task 7; D (tools) → Task 7; E (/account page) → Tasks 5-6; F (language) → Tasks 4, 6; G (testing) → Tasks 3, 4, 8, 9. All covered.
- **Type consistency:** `createPersonalApiClient`, `listMyApiClients`, `revokeMyApiClient`, `updateUserLanguage`, `SUPPORTED_LANGUAGES`, `updateLanguageSchema`, `createPersonalApiClientSchema` are named identically everywhere they're referenced across tasks (verified by re-reading Tasks 3-9 against each other after drafting).
- **Known, explicitly-flagged gap carried into this feature (not silently introduced):** `get_<key>` MCP tools don't verify the returned item's entity is within the caller's subtree, matching the pre-existing `/api/v1/[itemtype]/[id]` REST endpoint's same gap - documented in the route.ts comment in Task 7 rather than silently duplicated.
