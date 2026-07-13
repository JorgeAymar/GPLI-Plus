import "dotenv/config";
import { randomUUID } from "node:crypto";
import { apiClients, db, entities } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createApiClientSchema } from "../validation/api-client.zod";
import { createApiClient, hasScope, listApiClients, revokeApiClient, verifyApiKey } from "./api-client-service";

const PREFIX = "__vitest_platform__";

describe("api-client-service", () => {
  let entityId: string;

  beforeAll(async () => {
    const entity = await createEntity({ name: `${PREFIX}api_clients_${randomUUID()}` });
    entityId = entity.id;
  });

  afterAll(async () => {
    await db.delete(apiClients).where(eq(apiClients.entityId, entityId));
    await db.delete(entities).where(eq(entities.id, entityId));
  });

  it("createApiClient returns a raw bearer key and never persists it in plaintext", async () => {
    const { client, rawKey } = await createApiClient({
      entityId,
      name: `${PREFIX}client_create`,
      scopes: ["assets.computer"],
    });

    expect(rawKey.startsWith("sk_")).toBe(true);
    expect(client.apiKeyHash).not.toBe(rawKey);
    expect(client.apiKeyPrefix).toBe(rawKey.slice(0, 11));
    expect(client.isActive).toBe(true);
    expect(client.lastUsedAt).toBeNull();
  });

  it("verifyApiKey accepts a valid raw key and stamps lastUsedAt", async () => {
    const { rawKey } = await createApiClient({
      entityId,
      name: `${PREFIX}client_verify_ok`,
      scopes: ["assets.computer"],
    });

    const verified = await verifyApiKey(rawKey);
    expect(verified).not.toBeNull();
    expect(verified?.lastUsedAt).toBeInstanceOf(Date);
  });

  it("verifyApiKey rejects an invalid/tampered key", async () => {
    const { rawKey } = await createApiClient({
      entityId,
      name: `${PREFIX}client_verify_bad`,
      scopes: ["assets.computer"],
    });

    const tampered = rawKey.slice(0, -1) + (rawKey.at(-1) === "f" ? "0" : "f");
    const verified = await verifyApiKey(tampered);
    expect(verified).toBeNull();
  });

  it("verifyApiKey rejects a revoked client's key even though the raw key is still correct", async () => {
    const { client, rawKey } = await createApiClient({
      entityId,
      name: `${PREFIX}client_revoked`,
      scopes: ["assets.computer"],
    });

    // Sanity check: works before revocation.
    expect(await verifyApiKey(rawKey)).not.toBeNull();

    const revoked = await revokeApiClient(client.id);
    expect(revoked.isActive).toBe(false);

    const verifiedAfterRevoke = await verifyApiKey(rawKey);
    expect(verifiedAfterRevoke).toBeNull();
  });

  it("hasScope checks the client's granted MODULE.* scopes", async () => {
    const { client } = await createApiClient({
      entityId,
      name: `${PREFIX}client_scopes`,
      scopes: ["assets.computer", "assistance.ticket"],
    });

    expect(hasScope(client, "assets.computer")).toBe(true);
    expect(hasScope(client, "assistance.change")).toBe(false);
  });

  it("listApiClients scopes results to the given entity", async () => {
    const other = await createEntity({ name: `${PREFIX}api_clients_other_${randomUUID()}` });
    try {
      await createApiClient({ entityId: other.id, name: `${PREFIX}other_entity_client`, scopes: [] });
      const clients = await listApiClients(entityId);
      expect(clients.every((c) => c.entityId === entityId)).toBe(true);
      expect(clients.some((c) => c.name === `${PREFIX}other_entity_client`)).toBe(false);
    } finally {
      await db.delete(apiClients).where(eq(apiClients.entityId, other.id));
      await db.delete(entities).where(eq(entities.id, other.id));
    }
  });

  describe("createApiClientSchema (zod)", () => {
    it("accepts a valid payload", () => {
      const result = createApiClientSchema.safeParse({
        entityId: randomUUID(),
        name: "Integration client",
        scopes: ["assets.computer"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects a non-uuid entityId", () => {
      const result = createApiClientSchema.safeParse({ entityId: "not-a-uuid", name: "x", scopes: ["a"] });
      expect(result.success).toBe(false);
    });

    it("rejects an empty scopes array", () => {
      const result = createApiClientSchema.safeParse({ entityId: randomUUID(), name: "x", scopes: [] });
      expect(result.success).toBe(false);
    });

    it("rejects an empty name", () => {
      const result = createApiClientSchema.safeParse({ entityId: randomUUID(), name: "", scopes: ["a"] });
      expect(result.success).toBe(false);
    });
  });
});
