import {
  assets,
  db,
  inventoryAgents,
  inventoryLockedFields,
  inventorySubmissions,
  type InventoryAgent,
  type InventoryLockedField,
  type InventorySubmission,
} from "@itsm/db";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getAssetDefinitionByKey, listAssetFieldDefinitions } from "../assets/asset-definition-service";
import { createAsset, updateAsset } from "../assets/asset-service";
import { createComputer } from "../assets/computer-service";
import { listSubtree } from "../entities/entity-service";
import { evaluateRules } from "../rules/rule-engine";
import type { CreateAssetInput } from "../validation/asset.zod";
import type { SubmitInventoryInput } from "../validation/inventory.zod";

/** Looks up the agent by its self-reported deviceId, creating one on first contact. */
export async function getOrCreateInventoryAgent(deviceId: string, entityId: string, name: string): Promise<InventoryAgent> {
  const [existing] = await db.select().from(inventoryAgents).where(eq(inventoryAgents.deviceId, deviceId));
  if (existing) return existing;

  const [created] = await db.insert(inventoryAgents).values({ deviceId, entityId, name }).returning();
  if (!created) throw new Error("Failed to insert inventory agent");
  return created;
}

export async function listInventoryAgents(entityId: string, options?: { includeSubtree?: boolean }): Promise<InventoryAgent[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(inventoryAgents)
    .where(inArray(inventoryAgents.entityId, entityIds))
    .orderBy(inventoryAgents.name);
}

export async function listSubmissionsForAgent(agentId: string): Promise<InventorySubmission[]> {
  return db.select().from(inventorySubmissions).where(eq(inventorySubmissions.agentId, agentId)).orderBy(desc(inventorySubmissions.receivedAt));
}

export async function isFieldLocked(assetId: string, fieldName: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(inventoryLockedFields)
    .where(and(eq(inventoryLockedFields.assetId, assetId), eq(inventoryLockedFields.fieldName, fieldName)));
  return row !== undefined;
}

/** Idempotent - locking an already-locked field just returns the existing row instead of erroring. */
export async function lockField(assetId: string, fieldName: string): Promise<InventoryLockedField> {
  const [created] = await db.insert(inventoryLockedFields).values({ assetId, fieldName }).onConflictDoNothing().returning();
  if (created) return created;

  const [existing] = await db
    .select()
    .from(inventoryLockedFields)
    .where(and(eq(inventoryLockedFields.assetId, assetId), eq(inventoryLockedFields.fieldName, fieldName)));
  if (!existing) throw new Error("Failed to lock field");
  return existing;
}

export async function listLockedFields(assetId: string): Promise<InventoryLockedField[]> {
  return db.select().from(inventoryLockedFields).where(eq(inventoryLockedFields.assetId, assetId));
}

/**
 * Entry point for the agent-reporting protocol: records the raw submission
 * first (so nothing is lost even if matching/creation fails), runs it through
 * the "asset_import" rule chain (mirrors GLPI's import rules without its
 * XML/SNMP baggage - JSON in, JSON out), then either updates the asset it
 * matches by serialNumber or creates a new "computer" asset.
 *
 * Only `name`/`serialNumber` are refreshed on an existing-asset match in this
 * slice; `manufacturer`/`model`/`os` are only written into customFields at
 * creation time (per spec). Extending updates to also refresh those through
 * the same inventoryLockedFields check is straightforward follow-up work.
 */
export async function submitInventory(
  input: SubmitInventoryInput,
): Promise<{ assetId: string; created: boolean; submissionId: string }> {
  const agent = await getOrCreateInventoryAgent(input.deviceId, input.entityId, input.hostname);
  await db
    .update(inventoryAgents)
    .set({ lastContactAt: new Date(), updatedAt: new Date() })
    .where(eq(inventoryAgents.id, agent.id));

  const [submission] = await db
    .insert(inventorySubmissions)
    .values({ agentId: agent.id, rawPayload: input, status: "pending" })
    .returning();
  if (!submission) throw new Error("Failed to insert inventory submission");

  try {
    const { output } = await evaluateRules("asset_import", input.entityId, {
      serialNumber: input.serialNumber ?? null,
      macAddresses: (input.macAddresses ?? []).join(","),
      hostname: input.hostname,
      deviceId: input.deviceId,
    });

    // Rules may rewrite serialNumber (e.g. normalize/override it); fall back to the raw value.
    const effectiveSerialNumber =
      typeof output.serialNumber === "string" && output.serialNumber.length > 0 ? output.serialNumber : (input.serialNumber ?? null);

    const [existingAsset] = effectiveSerialNumber
      ? await db
          .select()
          .from(assets)
          .where(and(eq(assets.entityId, input.entityId), eq(assets.serialNumber, effectiveSerialNumber), isNull(assets.deletedAt)))
      : [];

    let assetId: string;
    let created: boolean;

    if (existingAsset) {
      const lockedNames = new Set((await listLockedFields(existingAsset.id)).map((f) => f.fieldName));
      const updatePayload: Partial<Omit<CreateAssetInput, "entityId" | "assetDefinitionId">> = {};
      if (!lockedNames.has("name")) updatePayload.name = input.hostname;
      if (!lockedNames.has("serialNumber")) updatePayload.serialNumber = effectiveSerialNumber;

      if (Object.keys(updatePayload).length > 0) {
        await updateAsset(existingAsset.id, updatePayload, null);
      }

      assetId = existingAsset.id;
      created = false;
    } else {
      const definition = await getAssetDefinitionByKey("computer");
      if (!definition) throw new Error('Asset definition "computer" not found - run the seed script first');

      // Only send customFields keys the "computer" type actually defines - anything else is silently dropped.
      const fieldDefs = await listAssetFieldDefinitions(definition.id);
      const allowedKeys = new Set(fieldDefs.map((f) => f.key));
      const customFields: Record<string, unknown> = {};
      if (input.manufacturer != null && allowedKeys.has("manufacturer")) customFields.manufacturer = input.manufacturer;
      if (input.model != null && allowedKeys.has("model")) customFields.model = input.model;
      if (input.os != null && allowedKeys.has("os")) customFields.os = input.os;

      const { asset } = await createComputer(
        { entityId: input.entityId, name: input.hostname, serialNumber: effectiveSerialNumber, customFields },
        null,
      );
      assetId = asset.id;
      created = true;
    }

    await db.update(inventoryAgents).set({ assetId, updatedAt: new Date() }).where(eq(inventoryAgents.id, agent.id));

    const [processed] = await db
      .update(inventorySubmissions)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(inventorySubmissions.id, submission.id))
      .returning();
    if (!processed) throw new Error("Failed to update inventory submission");

    return { assetId, created, submissionId: submission.id };
  } catch (err) {
    const rejectionReason = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(inventorySubmissions)
      .set({ status: "rejected", rejectionReason, processedAt: new Date() })
      .where(eq(inventorySubmissions.id, submission.id));
    throw err;
  }
}

/**
 * Closes the "Unmanaged Device" gap: an operator manually accepts a
 * submission that never matched (or was rejected by) the asset_import rule
 * chain, creating it as a standalone "unmanaged_device" asset instead of
 * requiring a serialNumber match against an existing asset.
 */
export async function acceptSubmissionAsUnmanaged(
  submissionId: string,
  entityId: string,
  actorUserId: string | null,
): Promise<{ assetId: string }> {
  const [submission] = await db.select().from(inventorySubmissions).where(eq(inventorySubmissions.id, submissionId));
  if (!submission) throw new Error(`Inventory submission ${submissionId} not found`);
  if (submission.status === "processed") throw new Error("Esta submission ya fue procesada");

  const definition = await getAssetDefinitionByKey("unmanaged_device");
  if (!definition) throw new Error('Asset definition "unmanaged_device" not found - run the seed script first');

  const hostname = (submission.rawPayload as { hostname?: string } | null)?.hostname ?? "Dispositivo sin nombre";

  const asset = await createAsset({ entityId, assetDefinitionId: definition.id, name: hostname }, actorUserId);

  await db
    .update(inventorySubmissions)
    .set({ status: "processed", processedAt: new Date() })
    .where(eq(inventorySubmissions.id, submissionId));

  return { assetId: asset.id };
}
