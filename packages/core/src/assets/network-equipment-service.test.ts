import "dotenv/config";
import { assets, auditLog, db, entities, networkEquipment, type AssetDefinition } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { getAssetDefinitionByKey } from "./asset-definition-service";
import { createNetworkEquipment, getNetworkEquipmentWithAsset, listNetworkEquipment } from "./network-equipment-service";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `__vitest_assets__${RUN}_`;

describe("network-equipment-service", () => {
  let entityId: string;
  let networkEquipmentDefinition: AssetDefinition;

  beforeAll(async () => {
    const entity = await createEntity({ name: `${PREFIX}netequip-root` });
    entityId = entity.id;

    const def = await getAssetDefinitionByKey("network_equipment");
    if (!def) throw new Error('Seed data missing: asset definition "network_equipment" not found. Run `pnpm seed` first.');
    networkEquipmentDefinition = def;
  });

  afterAll(async () => {
    await db.delete(auditLog).where(eq(auditLog.entityId, entityId));
    const ownAssets = await db.select({ id: assets.id }).from(assets).where(eq(assets.entityId, entityId));
    for (const { id } of ownAssets) {
      await db.delete(networkEquipment).where(eq(networkEquipment.assetId, id));
    }
    await db.delete(assets).where(eq(assets.entityId, entityId));
    await db.delete(entities).where(eq(entities.id, entityId));
  });

  it("creates an asset+network_equipment pair transactionally and links them 1:1", async () => {
    const { asset, networkEquipment: equipment } = await createNetworkEquipment(
      {
        entityId,
        name: `${PREFIX}switch-1`,
        serialNumber: `SN-${RUN}-sw1`,
        ipAddress: "10.0.0.1",
        macAddress: "AA:BB:CC:DD:EE:01",
        portsCount: 48,
      },
      null,
    );

    expect(asset.assetDefinitionId).toBe(networkEquipmentDefinition.id);
    expect(equipment.assetId).toBe(asset.id);
    expect(equipment.ipAddress).toBe("10.0.0.1");
    expect(equipment.portsCount).toBe(48);

    const auditRows = await db.select().from(auditLog).where(eq(auditLog.objectId, asset.id));
    expect(auditRows.some((r) => r.action === "create" && r.objectType === "asset")).toBe(true);
  });

  it("getNetworkEquipmentWithAsset joins both rows, and is undefined for an unknown assetId", async () => {
    const { asset } = await createNetworkEquipment({ entityId, name: `${PREFIX}switch-2` }, null);

    const found = await getNetworkEquipmentWithAsset(asset.id);
    expect(found?.asset.id).toBe(asset.id);
    expect(found?.networkEquipment.assetId).toBe(asset.id);

    expect(await getNetworkEquipmentWithAsset("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });

  it("listNetworkEquipment returns the merged asset+network_equipment row, scoped to the entity", async () => {
    const { asset } = await createNetworkEquipment({ entityId, name: `${PREFIX}switch-3`, firmwareVersion: "1.2.3" }, null);

    const list = await listNetworkEquipment(entityId);
    const found = list.find((e) => e.id === asset.id);
    expect(found).toBeDefined();
    expect(found?.firmwareVersion).toBe("1.2.3");
  });
});
