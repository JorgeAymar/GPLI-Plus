import "dotenv/config";
import {
  assetDefinitions,
  assets,
  budgets,
  contractAssets,
  contracts,
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
  createContract,
  getContract,
  linkContractAsset,
  listAssetsForContract,
  listContracts,
  unlinkContractAsset,
} from "./contract-service";

const PREFIX = "__vitest_mgmt__contract-service";

describe("contract-service", () => {
  let rootEntity: Entity;
  let childEntity: Entity;
  let supplier: Supplier;
  let assetDefinition: AssetDefinition;
  let asset: Asset;
  const contractIds: string[] = [];

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

    const [insertedAsset] = await db
      .insert(assets)
      .values({ entityId: rootEntity.id, assetDefinitionId: assetDefinition.id, name: `${PREFIX}-asset` })
      .returning();
    if (!insertedAsset) throw new Error("Failed to insert asset");
    asset = insertedAsset;
  });

  afterAll(async () => {
    if (contractIds.length) {
      await db.delete(contractAssets).where(inArray(contractAssets.contractId, contractIds));
      await db.delete(contracts).where(inArray(contracts.id, contractIds));
    }
    await db.delete(assets).where(eq(assets.id, asset.id));
    await db.delete(assetDefinitions).where(eq(assetDefinitions.id, assetDefinition.id));
    await db.delete(suppliers).where(eq(suppliers.id, supplier.id));
    await db.delete(entities).where(eq(entities.id, childEntity.id));
    await db.delete(entities).where(eq(entities.id, rootEntity.id));
  });

  it("applies default contractType/billingFrequency when creating with minimal input", async () => {
    const contract = await createContract({ entityId: rootEntity.id, name: `${PREFIX}-minimal` });
    contractIds.push(contract.id);

    expect(contract.contractType).toBe("other");
    expect(contract.billingFrequency).toBe("annual");
    expect(contract.costCents).toBeNull();
    expect(contract.startDate).toBeNull();
    expect(contract.endDate).toBeNull();
    expect(contract.deletedAt).toBeNull();
  });

  it("stores explicit contractType/billingFrequency/cost/dates and coerces date strings", async () => {
    const contract = await createContract({
      entityId: rootEntity.id,
      supplierId: supplier.id,
      name: `${PREFIX}-full`,
      contractType: "lease",
      billingFrequency: "monthly",
      costCents: 15000,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      renewalNoticeDays: 30,
    });
    contractIds.push(contract.id);

    expect(contract.contractType).toBe("lease");
    expect(contract.billingFrequency).toBe("monthly");
    expect(contract.costCents).toBe(15000);
    expect(contract.supplierId).toBe(supplier.id);
    expect(contract.startDate).toBeInstanceOf(Date);
    expect(contract.endDate).toBeInstanceOf(Date);
    expect(contract.renewalNoticeDays).toBe(30);

    const fetched = await getContract(contract.id);
    expect(fetched?.id).toBe(contract.id);
  });

  it("returns undefined from getContract for a non-existent id", async () => {
    const fetched = await getContract("00000000-0000-0000-0000-000000000000");
    expect(fetched).toBeUndefined();
  });

  it("scopes listContracts to the given entity by default, and includes the subtree when asked", async () => {
    const rootContract = await createContract({ entityId: rootEntity.id, name: `${PREFIX}-root-contract` });
    const childContract = await createContract({ entityId: childEntity.id, name: `${PREFIX}-child-contract` });
    contractIds.push(rootContract.id, childContract.id);

    const rootOnly = await listContracts(rootEntity.id);
    expect(rootOnly.map((c) => c.id)).toContain(rootContract.id);
    expect(rootOnly.map((c) => c.id)).not.toContain(childContract.id);

    const withSubtree = await listContracts(rootEntity.id, { includeSubtree: true });
    expect(withSubtree.map((c) => c.id)).toContain(rootContract.id);
    expect(withSubtree.map((c) => c.id)).toContain(childContract.id);
  });

  it("excludes soft-deleted contracts (deletedAt set) from listContracts", async () => {
    const contract = await createContract({ entityId: rootEntity.id, name: `${PREFIX}-soft-deleted` });
    contractIds.push(contract.id);

    // contract-service has no softDelete* export (unlike supplier/contact) - exercise the
    // deletedAt filter in listContracts directly against the column it reads.
    await db.update(contracts).set({ deletedAt: new Date() }).where(eq(contracts.id, contract.id));

    const list = await listContracts(rootEntity.id);
    expect(list.map((c) => c.id)).not.toContain(contract.id);
  });

  it("links/unlinks an asset to a contract and lists it", async () => {
    const contract = await createContract({ entityId: rootEntity.id, name: `${PREFIX}-linked` });
    contractIds.push(contract.id);

    await linkContractAsset(contract.id, asset.id);
    // Linking the same pair twice must not throw (onConflictDoNothing) or duplicate rows.
    await linkContractAsset(contract.id, asset.id);

    const linkedAssets = await listAssetsForContract(contract.id);
    expect(linkedAssets).toHaveLength(1);
    expect(linkedAssets[0]?.id).toBe(asset.id);

    await unlinkContractAsset(contract.id, asset.id);
    const afterUnlink = await listAssetsForContract(contract.id);
    expect(afterUnlink).toHaveLength(0);
  });

  it("has no direct FK relation between contracts and budgets - both are entity-scoped only", async () => {
    const contract = await createContract({ entityId: rootEntity.id, name: `${PREFIX}-with-budget-context`, costCents: 50000 });
    const [budget] = await db
      .insert(budgets)
      .values({ entityId: rootEntity.id, name: `${PREFIX}-budget`, amountCents: 100000 })
      .returning();
    if (!budget) throw new Error("Failed to insert budget");
    contractIds.push(contract.id);

    expect(contract.entityId).toBe(rootEntity.id);
    expect(budget.entityId).toBe(rootEntity.id);
    expect((contract as unknown as Record<string, unknown>).budgetId).toBeUndefined();

    await db.delete(budgets).where(eq(budgets.id, budget.id));
  });
});
