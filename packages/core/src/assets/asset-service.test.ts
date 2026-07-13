import "dotenv/config";
import { assetDefinitions, assetFieldDefinitions, assets, auditLog, db, entities, users, type AssetDefinition } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import {
  assignAsset,
  createAsset,
  getAsset,
  listAssets,
  purgeAsset,
  restoreAsset,
  softDeleteAsset,
  updateAsset,
} from "./asset-service";
import { createAssetDefinition } from "./asset-definition-service";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `__vitest_assets__${RUN}_`;

describe("asset-service", () => {
  let rootEntityId: string;
  let childEntityId: string;
  let definition: AssetDefinition;
  let existingUserId: string | undefined;
  const createdEntityIds: string[] = [];
  const createdDefinitionIds: string[] = [];

  beforeAll(async () => {
    const root = await createEntity({ name: `${PREFIX}root` });
    rootEntityId = root.id;
    createdEntityIds.push(root.id);

    const child = await createEntity({ name: `${PREFIX}child`, parentId: root.id });
    childEntityId = child.id;
    createdEntityIds.push(child.id);

    definition = await createAssetDefinition({ key: `${PREFIX}widget`, name: "Widget de prueba" });
    createdDefinitionIds.push(definition.id);
    await db.insert(assetFieldDefinitions).values([
      { assetDefinitionId: definition.id, key: "cpu_cores", label: "Núcleos de CPU", fieldType: "number", isRequired: true },
      { assetDefinitionId: definition.id, key: "notes", label: "Notas", fieldType: "text", isRequired: false },
    ]);

    const [anyUser] = await db.select().from(users).limit(1);
    existingUserId = anyUser?.id;
  });

  afterAll(async () => {
    // audit_log.entity_id has no cascade, so it must be cleared before the entities can be deleted.
    await db.delete(auditLog).where(eq(auditLog.entityId, rootEntityId));
    await db.delete(auditLog).where(eq(auditLog.entityId, childEntityId));

    // assets cascade-delete their own extension rows, but not entities/definitions - clean those separately.
    await db.delete(assets).where(eq(assets.entityId, rootEntityId));
    await db.delete(assets).where(eq(assets.entityId, childEntityId));

    for (const id of createdDefinitionIds) {
      await db.delete(assetFieldDefinitions).where(eq(assetFieldDefinitions.assetDefinitionId, id));
    }
    for (const id of createdDefinitionIds) {
      await db.delete(assetDefinitions).where(eq(assetDefinitions.id, id));
    }

    // children before parents (entities.parentId has no cascade)
    await db.delete(entities).where(eq(entities.id, childEntityId));
    await db.delete(entities).where(eq(entities.id, rootEntityId));
  });

  it("rejects creation when a required custom field is missing", async () => {
    await expect(
      createAsset(
        { entityId: rootEntityId, assetDefinitionId: definition.id, name: `${PREFIX}missing-required`, customFields: {} },
        null,
      ),
    ).rejects.toThrow();
  });

  it("rejects creation when a required custom field has the wrong type", async () => {
    await expect(
      createAsset(
        {
          entityId: rootEntityId,
          assetDefinitionId: definition.id,
          name: `${PREFIX}wrong-type`,
          customFields: { cpu_cores: "muchos" },
        },
        null,
      ),
    ).rejects.toThrow();
  });

  it("creates an asset when all custom fields are valid, and records an audit log entry", async () => {
    const asset = await createAsset(
      {
        entityId: rootEntityId,
        assetDefinitionId: definition.id,
        name: `${PREFIX}valid-widget`,
        serialNumber: `SN-${RUN}-1`,
        customFields: { cpu_cores: "8", notes: "ok" },
      },
      existingUserId ?? null,
    );

    expect(asset.id).toBeTruthy();
    expect(asset.name).toBe(`${PREFIX}valid-widget`);
    // cpu_cores was coerced from the string "8" to the number 8 by validateCustomFields.
    expect(asset.customFields).toEqual({ cpu_cores: 8, notes: "ok" });

    const fetched = await getAsset(asset.id);
    expect(fetched?.id).toBe(asset.id);

    const auditRows = await db.select().from(auditLog).where(eq(auditLog.objectId, asset.id));
    expect(auditRows.some((r) => r.action === "create" && r.objectType === "asset")).toBe(true);
  });

  it("getAsset returns undefined for an id that does not exist", async () => {
    expect(await getAsset("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });

  it("enforces the unique inventory number constraint", async () => {
    const inventoryNumber = `INV-${RUN}-DUP`;
    await createAsset(
      {
        entityId: rootEntityId,
        assetDefinitionId: definition.id,
        name: `${PREFIX}inv-1`,
        inventoryNumber,
        customFields: { cpu_cores: 1 },
      },
      null,
    );

    await expect(
      createAsset(
        {
          entityId: rootEntityId,
          assetDefinitionId: definition.id,
          name: `${PREFIX}inv-2`,
          inventoryNumber,
          customFields: { cpu_cores: 2 },
        },
        null,
      ),
    ).rejects.toThrow();
  });

  describe("listAssets", () => {
    it("filters by entity, supports search by name/serial/inventory, and excludes soft-deleted by default", async () => {
      const target = await createAsset(
        {
          entityId: rootEntityId,
          assetDefinitionId: definition.id,
          name: `${PREFIX}searchable-name`,
          serialNumber: `${PREFIX}serial-abc`,
          customFields: { cpu_cores: 4 },
        },
        null,
      );

      const byName = await listAssets(rootEntityId, { search: "searchable-name" });
      expect(byName.some((a) => a.id === target.id)).toBe(true);

      const bySerial = await listAssets(rootEntityId, { search: "serial-abc" });
      expect(bySerial.some((a) => a.id === target.id)).toBe(true);

      const noMatch = await listAssets(rootEntityId, { search: `${PREFIX}does-not-exist-anywhere` });
      expect(noMatch.some((a) => a.id === target.id)).toBe(false);

      await softDeleteAsset(target.id, null);
      const afterDelete = await listAssets(rootEntityId, { search: "searchable-name" });
      expect(afterDelete.some((a) => a.id === target.id)).toBe(false);

      const withDeleted = await listAssets(rootEntityId, { search: "searchable-name", includeDeleted: true });
      expect(withDeleted.some((a) => a.id === target.id)).toBe(true);

      await restoreAsset(target.id, null);
    });

    it("only includes descendant-entity assets when includeSubtree is true", async () => {
      const inChild = await createAsset(
        { entityId: childEntityId, assetDefinitionId: definition.id, name: `${PREFIX}in-child`, customFields: { cpu_cores: 2 } },
        null,
      );

      const rootOnly = await listAssets(rootEntityId);
      expect(rootOnly.some((a) => a.id === inChild.id)).toBe(false);

      const rootSubtree = await listAssets(rootEntityId, { includeSubtree: true });
      expect(rootSubtree.some((a) => a.id === inChild.id)).toBe(true);

      const childDirect = await listAssets(childEntityId);
      expect(childDirect.some((a) => a.id === inChild.id)).toBe(true);
    });

    it("filters by assetDefinitionId", async () => {
      const otherDefinition = await createAssetDefinition({ key: `${PREFIX}other_type`, name: "Otro tipo" });
      createdDefinitionIds.push(otherDefinition.id);

      const ofOtherType = await createAsset(
        { entityId: rootEntityId, assetDefinitionId: otherDefinition.id, name: `${PREFIX}other-type-asset` },
        null,
      );

      const filtered = await listAssets(rootEntityId, { assetDefinitionId: otherDefinition.id });
      expect(filtered.every((a) => a.assetDefinitionId === otherDefinition.id)).toBe(true);
      expect(filtered.some((a) => a.id === ofOtherType.id)).toBe(true);

      const filteredForWidget = await listAssets(rootEntityId, { assetDefinitionId: definition.id });
      expect(filteredForWidget.some((a) => a.id === ofOtherType.id)).toBe(false);
    });
  });

  describe("updateAsset", () => {
    it("updates plain fields and re-validates customFields when provided", async () => {
      const asset = await createAsset(
        { entityId: rootEntityId, assetDefinitionId: definition.id, name: `${PREFIX}to-update`, customFields: { cpu_cores: 2 } },
        null,
      );

      const updated = await updateAsset(asset.id, { name: `${PREFIX}updated-name`, customFields: { cpu_cores: 16 } }, null);
      expect(updated.name).toBe(`${PREFIX}updated-name`);
      expect(updated.customFields).toEqual({ cpu_cores: 16 });
    });

    it("leaves customFields untouched when the update payload omits it entirely", async () => {
      const asset = await createAsset(
        {
          entityId: rootEntityId,
          assetDefinitionId: definition.id,
          name: `${PREFIX}partial-update`,
          customFields: { cpu_cores: 6, notes: "keep me" },
        },
        null,
      );

      const updated = await updateAsset(asset.id, { name: `${PREFIX}partial-update-renamed` }, null);
      expect(updated.name).toBe(`${PREFIX}partial-update-renamed`);
      expect(updated.customFields).toEqual({ cpu_cores: 6, notes: "keep me" });
    });

    it("rejects an update with an invalid customFields payload", async () => {
      const asset = await createAsset(
        { entityId: rootEntityId, assetDefinitionId: definition.id, name: `${PREFIX}invalid-update`, customFields: { cpu_cores: 2 } },
        null,
      );

      await expect(updateAsset(asset.id, { customFields: { cpu_cores: "not-a-number" } }, null)).rejects.toThrow();
    });

    it("throws when the asset does not exist", async () => {
      await expect(updateAsset("00000000-0000-0000-0000-000000000000", { name: "x" }, null)).rejects.toThrow();
    });
  });

  describe("assignAsset", () => {
    it("assigns and then clears a userId", async () => {
      const asset = await createAsset(
        { entityId: rootEntityId, assetDefinitionId: definition.id, name: `${PREFIX}assignable`, customFields: { cpu_cores: 2 } },
        null,
      );

      if (existingUserId) {
        const assigned = await assignAsset(asset.id, { userId: existingUserId }, null);
        expect(assigned.userId).toBe(existingUserId);
      }

      const cleared = await assignAsset(asset.id, { userId: null, groupId: null }, null);
      expect(cleared.userId).toBeNull();
      expect(cleared.groupId).toBeNull();
    });
  });

  describe("soft delete / restore / purge", () => {
    it("soft-deletes and restores an asset", async () => {
      const asset = await createAsset(
        { entityId: rootEntityId, assetDefinitionId: definition.id, name: `${PREFIX}soft-delete`, customFields: { cpu_cores: 2 } },
        null,
      );

      const deleted = await softDeleteAsset(asset.id, null);
      expect(deleted.deletedAt).not.toBeNull();

      const restored = await restoreAsset(asset.id, null);
      expect(restored.deletedAt).toBeNull();
    });

    it("purges an asset permanently", async () => {
      const asset = await createAsset(
        { entityId: rootEntityId, assetDefinitionId: definition.id, name: `${PREFIX}purge-me`, customFields: { cpu_cores: 2 } },
        null,
      );

      await purgeAsset(asset.id, null);
      expect(await getAsset(asset.id)).toBeUndefined();
    });

    it("throws when soft-deleting/restoring/purging an asset that does not exist", async () => {
      const missingId = "00000000-0000-0000-0000-000000000000";
      await expect(softDeleteAsset(missingId, null)).rejects.toThrow();
      await expect(restoreAsset(missingId, null)).rejects.toThrow();
      await expect(purgeAsset(missingId, null)).rejects.toThrow();
    });
  });
});
