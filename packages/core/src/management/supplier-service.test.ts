import "dotenv/config";
import { db, entities, suppliers, type Entity } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createSupplier, getSupplier, listSuppliers, softDeleteSupplier } from "./supplier-service";

const PREFIX = "__vitest_mgmt__supplier-service";

describe("supplier-service", () => {
  let rootEntity: Entity;
  let childEntity: Entity;
  const supplierIds: string[] = [];

  beforeAll(async () => {
    rootEntity = await createEntity({ name: `${PREFIX}-root` });
    childEntity = await createEntity({ name: `${PREFIX}-child`, parentId: rootEntity.id });
  });

  afterAll(async () => {
    if (supplierIds.length) await db.delete(suppliers).where(inArray(suppliers.id, supplierIds));
    await db.delete(entities).where(eq(entities.id, childEntity.id));
    await db.delete(entities).where(eq(entities.id, rootEntity.id));
  });

  it("creates a supplier and retrieves it by id", async () => {
    const supplier = await createSupplier({ entityId: rootEntity.id, name: `${PREFIX}-acme` });
    supplierIds.push(supplier.id);

    expect(supplier.id).toBeTruthy();
    expect(supplier.name).toBe(`${PREFIX}-acme`);
    expect(supplier.deletedAt).toBeNull();

    const fetched = await getSupplier(supplier.id);
    expect(fetched?.id).toBe(supplier.id);
  });

  it("returns undefined for a non-existent supplier id", async () => {
    const fetched = await getSupplier("00000000-0000-0000-0000-000000000000");
    expect(fetched).toBeUndefined();
  });

  it("scopes listSuppliers to the given entity by default, and includes the subtree when asked", async () => {
    const rootSupplier = await createSupplier({ entityId: rootEntity.id, name: `${PREFIX}-root-supplier` });
    const childSupplier = await createSupplier({ entityId: childEntity.id, name: `${PREFIX}-child-supplier` });
    supplierIds.push(rootSupplier.id, childSupplier.id);

    const rootOnly = await listSuppliers(rootEntity.id);
    expect(rootOnly.map((s) => s.id)).toContain(rootSupplier.id);
    expect(rootOnly.map((s) => s.id)).not.toContain(childSupplier.id);

    const withSubtree = await listSuppliers(rootEntity.id, { includeSubtree: true });
    expect(withSubtree.map((s) => s.id)).toContain(rootSupplier.id);
    expect(withSubtree.map((s) => s.id)).toContain(childSupplier.id);
  });

  it("soft-deletes a supplier and excludes it from listSuppliers", async () => {
    const supplier = await createSupplier({ entityId: rootEntity.id, name: `${PREFIX}-to-delete` });
    supplierIds.push(supplier.id);

    const deleted = await softDeleteSupplier(supplier.id);
    expect(deleted.deletedAt).not.toBeNull();

    const list = await listSuppliers(rootEntity.id);
    expect(list.map((s) => s.id)).not.toContain(supplier.id);
  });

  it("throws when soft-deleting a non-existent supplier", async () => {
    await expect(softDeleteSupplier("00000000-0000-0000-0000-000000000000")).rejects.toThrow();
  });
});
