import "dotenv/config";
import { assetComponents, assets, auditLog, computers, db, entities, type AssetDefinition } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { getAssetDefinitionByKey } from "./asset-definition-service";
import {
  addAssetComponent,
  createComputer,
  getComputerWithAsset,
  listAssetComponents,
  listComputers,
  removeAssetComponent,
} from "./computer-service";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `__vitest_assets__${RUN}_`;

describe("computer-service", () => {
  let entityId: string;
  let computerDefinition: AssetDefinition;

  beforeAll(async () => {
    const entity = await createEntity({ name: `${PREFIX}computers-root` });
    entityId = entity.id;

    const def = await getAssetDefinitionByKey("computer");
    if (!def) throw new Error('Seed data missing: asset definition "computer" not found. Run `pnpm seed` first.');
    computerDefinition = def;
  });

  afterAll(async () => {
    await db.delete(auditLog).where(eq(auditLog.entityId, entityId));
    // asset_components/computers cascade-delete with their asset, but delete them explicitly
    // first anyway to respect FK order (component/extension rows before the asset they reference).
    const ownAssets = await db.select({ id: assets.id }).from(assets).where(eq(assets.entityId, entityId));
    for (const { id } of ownAssets) {
      await db.delete(assetComponents).where(eq(assetComponents.assetId, id));
      await db.delete(computers).where(eq(computers.assetId, id));
    }
    await db.delete(assets).where(eq(assets.entityId, entityId));
    await db.delete(entities).where(eq(entities.id, entityId));
  });

  it("creates an asset+computer pair transactionally and links them 1:1", async () => {
    const { asset, computer } = await createComputer(
      { entityId, name: `${PREFIX}pc-1`, serialNumber: `SN-${RUN}-pc1`, domain: "corp.local" },
      null,
    );

    expect(asset.assetDefinitionId).toBe(computerDefinition.id);
    expect(computer.assetId).toBe(asset.id);
    expect(computer.domain).toBe("corp.local");

    const auditRows = await db.select().from(auditLog).where(eq(auditLog.objectId, asset.id));
    expect(auditRows.some((r) => r.action === "create" && r.objectType === "asset")).toBe(true);
  });

  it("getComputerWithAsset joins both rows for a given assetId, and is undefined otherwise", async () => {
    const { asset } = await createComputer({ entityId, name: `${PREFIX}pc-2` }, null);

    const found = await getComputerWithAsset(asset.id);
    expect(found?.asset.id).toBe(asset.id);
    expect(found?.computer.assetId).toBe(asset.id);

    expect(await getComputerWithAsset("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });

  it("listComputers returns the merged asset+computer row, scoped to the entity", async () => {
    const { asset } = await createComputer({ entityId, name: `${PREFIX}pc-3`, domain: "listable.local" }, null);

    const list = await listComputers(entityId);
    const found = list.find((c) => c.id === asset.id);
    expect(found).toBeDefined();
    expect(found?.domain).toBe("listable.local");
  });

  it("manages components (add/list/remove) for a computer asset", async () => {
    const { asset } = await createComputer({ entityId, name: `${PREFIX}pc-with-components` }, null);

    const cpu = await addAssetComponent({ assetId: asset.id, componentType: "cpu", name: "Ryzen 9", quantity: 1 });
    const ram = await addAssetComponent({
      assetId: asset.id,
      componentType: "ram",
      name: "DDR5",
      quantity: 2,
      capacityValue: 16,
      capacityUnit: "GB",
    });

    const components = await listAssetComponents(asset.id);
    expect(components.map((c) => c.id).sort()).toEqual([cpu.id, ram.id].sort());
    expect(components.find((c) => c.id === ram.id)?.capacityValue).toBe(16);

    await removeAssetComponent(cpu.id);
    const afterRemoval = await listAssetComponents(asset.id);
    expect(afterRemoval.map((c) => c.id)).toEqual([ram.id]);
  });
});
