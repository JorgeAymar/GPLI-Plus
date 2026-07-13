import "dotenv/config";
import { randomUUID } from "node:crypto";
import { assets, auditLog, db, entities, inventoryAgents, inventorySubmissions } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAssetDefinitionByKey } from "../assets/asset-definition-service";
import { getAsset } from "../assets/asset-service";
import { createEntity } from "../entities/entity-service";
import { submitInventorySchema } from "../validation/inventory.zod";
import {
  acceptSubmissionAsUnmanaged,
  getOrCreateInventoryAgent,
  isFieldLocked,
  listInventoryAgents,
  listLockedFields,
  listSubmissionsForAgent,
  lockField,
} from "./inventory-service";

const PREFIX = "__vitest_platform__";

describe("inventory-service", () => {
  let entityId: string;
  const createdAssetIds: string[] = [];
  const createdAgentIds: string[] = [];

  beforeAll(async () => {
    const entity = await createEntity({ name: `${PREFIX}inventory_${randomUUID()}` });
    entityId = entity.id;
  });

  afterAll(async () => {
    await db.delete(auditLog).where(eq(auditLog.entityId, entityId));
    // inventory_locked_fields.asset_id cascades on delete, so removing the asset is enough.
    for (const assetId of createdAssetIds) {
      await db.delete(assets).where(eq(assets.id, assetId));
    }
    for (const agentId of createdAgentIds) {
      await db.delete(inventorySubmissions).where(eq(inventorySubmissions.agentId, agentId));
      await db.delete(inventoryAgents).where(eq(inventoryAgents.id, agentId));
    }
    await db.delete(entities).where(eq(entities.id, entityId));
  });

  it("getOrCreateInventoryAgent is idempotent per deviceId", async () => {
    const deviceId = `${PREFIX}device_${randomUUID()}`;
    const first = await getOrCreateInventoryAgent(deviceId, entityId, "Agent One");
    createdAgentIds.push(first.id);
    const second = await getOrCreateInventoryAgent(deviceId, entityId, "Agent One (renamed attempt)");

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Agent One"); // unchanged - existing row wins, no upsert of name
  });

  it("listInventoryAgents scopes to the given entity", async () => {
    const deviceId = `${PREFIX}device_${randomUUID()}`;
    const agent = await getOrCreateInventoryAgent(deviceId, entityId, "Agent Two");
    createdAgentIds.push(agent.id);

    const agents = await listInventoryAgents(entityId);
    expect(agents.some((a) => a.id === agent.id)).toBe(true);
  });

  it("acceptSubmissionAsUnmanaged creates an unmanaged_device asset from a submission that never matched", async () => {
    const deviceId = `${PREFIX}device_${randomUUID()}`;
    const agent = await getOrCreateInventoryAgent(deviceId, entityId, "Unmatched Agent");
    createdAgentIds.push(agent.id);

    // Simulates a submission the asset_import rule chain rejected (or that simply never matched
    // an existing asset by serialNumber) - the realistic precondition for the manual-accept path.
    const [submission] = await db
      .insert(inventorySubmissions)
      .values({
        agentId: agent.id,
        rawPayload: { hostname: "unmatched-laptop-01" },
        status: "rejected",
        rejectionReason: "no serial number match",
      })
      .returning();
    expect(submission).toBeDefined();

    const { assetId } = await acceptSubmissionAsUnmanaged(submission!.id, entityId, null);
    createdAssetIds.push(assetId);

    const asset = await getAsset(assetId);
    expect(asset).toBeDefined();
    expect(asset?.name).toBe("unmatched-laptop-01");
    expect(asset?.entityId).toBe(entityId);

    const unmanagedDefinition = await getAssetDefinitionByKey("unmanaged_device");
    expect(asset?.assetDefinitionId).toBe(unmanagedDefinition?.id);

    const [processedRow] = await db.select().from(inventorySubmissions).where(eq(inventorySubmissions.id, submission!.id));
    expect(processedRow?.status).toBe("processed");

    const submissionsForAgent = await listSubmissionsForAgent(agent.id);
    expect(submissionsForAgent.some((s) => s.id === submission!.id && s.status === "processed")).toBe(true);
  });

  it("acceptSubmissionAsUnmanaged refuses to re-process an already-processed submission", async () => {
    const deviceId = `${PREFIX}device_${randomUUID()}`;
    const agent = await getOrCreateInventoryAgent(deviceId, entityId, "Already Processed Agent");
    createdAgentIds.push(agent.id);

    const [submission] = await db
      .insert(inventorySubmissions)
      .values({ agentId: agent.id, rawPayload: { hostname: "already-done" }, status: "processed" })
      .returning();

    await expect(acceptSubmissionAsUnmanaged(submission!.id, entityId, null)).rejects.toThrow();
  });

  it("acceptSubmissionAsUnmanaged throws for a non-existent submission id", async () => {
    await expect(acceptSubmissionAsUnmanaged(randomUUID(), entityId, null)).rejects.toThrow();
  });

  it("lockField/isFieldLocked/listLockedFields protect a field from future overwrites, idempotently", async () => {
    const deviceId = `${PREFIX}device_${randomUUID()}`;
    const agent = await getOrCreateInventoryAgent(deviceId, entityId, "Lock Field Agent");
    createdAgentIds.push(agent.id);

    const [submission] = await db
      .insert(inventorySubmissions)
      .values({ agentId: agent.id, rawPayload: { hostname: "lock-field-host" }, status: "rejected" })
      .returning();
    const { assetId } = await acceptSubmissionAsUnmanaged(submission!.id, entityId, null);
    createdAssetIds.push(assetId);

    expect(await isFieldLocked(assetId, "name")).toBe(false);

    const locked = await lockField(assetId, "name");
    expect(locked.fieldName).toBe("name");
    expect(await isFieldLocked(assetId, "name")).toBe(true);

    // Idempotent: locking again returns the same row instead of throwing a unique-constraint error.
    const lockedAgain = await lockField(assetId, "name");
    expect(lockedAgain.id).toBe(locked.id);

    const allLocked = await listLockedFields(assetId);
    expect(allLocked).toHaveLength(1);
  });

  describe("inventory zod schema", () => {
    it("submitInventorySchema requires deviceId/entityId(uuid)/hostname, others optional", () => {
      expect(
        submitInventorySchema.safeParse({ deviceId: "abc", entityId: randomUUID(), hostname: "host-1" }).success,
      ).toBe(true);
      expect(submitInventorySchema.safeParse({ deviceId: "", entityId: randomUUID(), hostname: "host-1" }).success).toBe(
        false,
      );
      expect(submitInventorySchema.safeParse({ deviceId: "abc", entityId: "not-a-uuid", hostname: "host-1" }).success).toBe(
        false,
      );
      expect(
        submitInventorySchema.safeParse({
          deviceId: "abc",
          entityId: randomUUID(),
          hostname: "host-1",
          serialNumber: null,
          macAddresses: ["aa:bb:cc:dd:ee:ff"],
        }).success,
      ).toBe(true);
    });
  });
});
