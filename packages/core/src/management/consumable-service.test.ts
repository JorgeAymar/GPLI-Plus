import "dotenv/config";
import {
  assetDefinitions,
  assets,
  consumableItems,
  consumables,
  db,
  entities,
  suppliers,
  type Asset,
  type AssetDefinition,
  type Entity,
  type Supplier,
} from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import {
  addConsumableUnits,
  countAvailable,
  createConsumableItem,
  getConsumableItem,
  isBelowAlertThreshold,
  listConsumableItems,
  listConsumables,
  retireConsumable,
  useConsumable,
} from "./consumable-service";

const PREFIX = "__vitest_mgmt__consumable-service";

describe("consumable-service", () => {
  let rootEntity: Entity;
  let childEntity: Entity;
  let supplier: Supplier;
  let assetDefinition: AssetDefinition;
  let assetA: Asset;
  let assetB: Asset;
  const consumableItemIds: string[] = [];

  beforeAll(async () => {
    rootEntity = await createEntity({ name: `${PREFIX}-root` });
    childEntity = await createEntity({ name: `${PREFIX}-child`, parentId: rootEntity.id });
    const [insertedSupplier] = await db
      .insert(suppliers)
      .values({ entityId: rootEntity.id, name: `${PREFIX}-supplier` })
      .returning();
    if (!insertedSupplier) throw new Error("Failed to insert supplier");
    supplier = insertedSupplier;

    const [insertedDefinition] = await db
      .insert(assetDefinitions)
      .values({ key: `${PREFIX}-def`, name: `${PREFIX}-def` })
      .returning();
    if (!insertedDefinition) throw new Error("Failed to insert asset definition");
    assetDefinition = insertedDefinition;

    const [insertedAssetA] = await db
      .insert(assets)
      .values({ entityId: rootEntity.id, assetDefinitionId: assetDefinition.id, name: `${PREFIX}-printer-a` })
      .returning();
    if (!insertedAssetA) throw new Error("Failed to insert asset A");
    assetA = insertedAssetA;

    const [insertedAssetB] = await db
      .insert(assets)
      .values({ entityId: rootEntity.id, assetDefinitionId: assetDefinition.id, name: `${PREFIX}-printer-b` })
      .returning();
    if (!insertedAssetB) throw new Error("Failed to insert asset B");
    assetB = insertedAssetB;
  });

  afterAll(async () => {
    // consumables.assignedAssetId has no ON DELETE CASCADE toward assets -> delete every
    // consumable unit (whatever its status) before deleting the assets/consumableItems/entities
    // they reference.
    if (consumableItemIds.length) {
      await db.delete(consumables).where(inArray(consumables.consumableItemId, consumableItemIds));
      await db.delete(consumableItems).where(inArray(consumableItems.id, consumableItemIds));
    }
    await db.delete(assets).where(inArray(assets.id, [assetA.id, assetB.id]));
    await db.delete(assetDefinitions).where(eq(assetDefinitions.id, assetDefinition.id));
    await db.delete(suppliers).where(eq(suppliers.id, supplier.id));
    await db.delete(entities).where(eq(entities.id, childEntity.id));
    await db.delete(entities).where(eq(entities.id, rootEntity.id));
  });

  it("creates a consumable item and retrieves it by id", async () => {
    const item = await createConsumableItem({
      entityId: rootEntity.id,
      name: `${PREFIX}-toner`,
      supplierId: supplier.id,
      alertThreshold: 2,
    });
    consumableItemIds.push(item.id);

    expect(item.name).toBe(`${PREFIX}-toner`);
    expect(item.alertThreshold).toBe(2);

    const fetched = await getConsumableItem(item.id);
    expect(fetched?.id).toBe(item.id);
  });

  it("scopes listConsumableItems to the given entity by default, and includes the subtree when asked", async () => {
    const rootItem = await createConsumableItem({ entityId: rootEntity.id, name: `${PREFIX}-root-item` });
    const childItem = await createConsumableItem({ entityId: childEntity.id, name: `${PREFIX}-child-item` });
    consumableItemIds.push(rootItem.id, childItem.id);

    const rootOnly = await listConsumableItems(rootEntity.id);
    expect(rootOnly.map((i) => i.id)).toContain(rootItem.id);
    expect(rootOnly.map((i) => i.id)).not.toContain(childItem.id);

    const withSubtree = await listConsumableItems(rootEntity.id, { includeSubtree: true });
    expect(withSubtree.map((i) => i.id)).toContain(rootItem.id);
    expect(withSubtree.map((i) => i.id)).toContain(childItem.id);
  });

  it("walks a unit through new -> in_use -> used, with countAvailable reflecting each transition", async () => {
    const item = await createConsumableItem({ entityId: rootEntity.id, name: `${PREFIX}-lifecycle` });
    consumableItemIds.push(item.id);

    // 1. Add 3 fresh units - all start as "new".
    const created = await addConsumableUnits(item.id, 3);
    expect(created).toHaveLength(3);
    for (const unit of created) {
      expect(unit.status).toBe("new");
      expect(unit.assignedAssetId).toBeNull();
      expect(unit.useDate).toBeNull();
    }
    expect(await countAvailable(item.id)).toBe(3);

    // 2. Assign one unit to assetA -> status flips to "in_use", available drops by one.
    const [firstUnit, secondUnit, thirdUnit] = created;
    const inUse = await useConsumable(firstUnit!.id, assetA.id);
    expect(inUse.status).toBe("in_use");
    expect(inUse.assignedAssetId).toBe(assetA.id);
    expect(inUse.useDate).toBeInstanceOf(Date);
    expect(await countAvailable(item.id)).toBe(2);

    // 3. Assign a second unit to assetB - available drops again.
    await useConsumable(secondUnit!.id, assetB.id);
    expect(await countAvailable(item.id)).toBe(1);

    // 4. Retire the first (in_use) unit -> status flips to "used"; countAvailable does not
    // change again because "used" was already excluded from the "new" count.
    const retired = await retireConsumable(firstUnit!.id);
    expect(retired.status).toBe("used");
    expect(await countAvailable(item.id)).toBe(1);

    // 5. The still-fresh third unit remains available and untouched.
    const untouched = (await listConsumables(item.id)).find((c) => c.id === thirdUnit!.id);
    expect(untouched?.status).toBe("new");

    // 6. listConsumables reflects a native Postgres enum ordering by declaration order
    // (new < in_use < used), not alphabetical - "new" sorts before "in_use" before "used".
    const all = await listConsumables(item.id);
    const statusOrder = all.map((c) => c.status);
    expect(statusOrder.indexOf("new")).toBeLessThan(statusOrder.indexOf("in_use"));
    expect(statusOrder.indexOf("in_use")).toBeLessThan(statusOrder.indexOf("used"));
  });

  it("rejects using a unit that is not in 'new' status", async () => {
    const item = await createConsumableItem({ entityId: rootEntity.id, name: `${PREFIX}-double-use` });
    consumableItemIds.push(item.id);
    const [unit] = await addConsumableUnits(item.id, 1);

    await useConsumable(unit!.id, assetA.id);
    await expect(useConsumable(unit!.id, assetB.id)).rejects.toThrow(/not available/i);
  });

  it("throws when using or retiring a non-existent consumable id", async () => {
    const missingId = "00000000-0000-0000-0000-000000000000";
    await expect(useConsumable(missingId, assetA.id)).rejects.toThrow();
    await expect(retireConsumable(missingId)).rejects.toThrow();
  });

  it("reports isBelowAlertThreshold false with no threshold set, and true once available stock drops below it", async () => {
    const noThresholdItem = await createConsumableItem({ entityId: rootEntity.id, name: `${PREFIX}-no-threshold` });
    consumableItemIds.push(noThresholdItem.id);
    await addConsumableUnits(noThresholdItem.id, 1);
    expect(await isBelowAlertThreshold(noThresholdItem.id)).toBe(false);

    const thresholdItem = await createConsumableItem({
      entityId: rootEntity.id,
      name: `${PREFIX}-threshold`,
      alertThreshold: 2,
    });
    consumableItemIds.push(thresholdItem.id);
    const units = await addConsumableUnits(thresholdItem.id, 3);
    expect(await countAvailable(thresholdItem.id)).toBe(3);
    expect(await isBelowAlertThreshold(thresholdItem.id)).toBe(false);

    // Use 2 of the 3 units -> only 1 left in stock, below the threshold of 2.
    await useConsumable(units[0]!.id, assetA.id);
    await useConsumable(units[1]!.id, assetB.id);
    expect(await countAvailable(thresholdItem.id)).toBe(1);
    expect(await isBelowAlertThreshold(thresholdItem.id)).toBe(true);
  });

  it("returns false from isBelowAlertThreshold for a non-existent consumable item", async () => {
    expect(await isBelowAlertThreshold("00000000-0000-0000-0000-000000000000")).toBe(false);
  });
});
