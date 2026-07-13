import { db, entities, serviceCatalogItems, type Entity } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import {
  createServiceCatalogItem,
  getServiceCatalogItem,
  listServiceCatalogItems,
  updateServiceCatalogItem,
} from "./service-catalog-service";

const PREFIX = "__vitest_itil__service_catalog";

let parentEntity: Entity;
let childEntity: Entity;
const itemIds: string[] = [];

beforeAll(async () => {
  parentEntity = await createEntity({ name: `${PREFIX}_parent_${Date.now()}` });
  childEntity = await createEntity({ name: `${PREFIX}_child_${Date.now()}`, parentId: parentEntity.id });
});

afterAll(async () => {
  if (itemIds.length > 0) {
    await db.delete(serviceCatalogItems).where(inArray(serviceCatalogItems.id, itemIds));
  }
  await db.delete(entities).where(eq(entities.id, childEntity.id));
  await db.delete(entities).where(eq(entities.id, parentEntity.id));
});

describe("service-catalog-service", () => {
  it("creates a catalog item with defaults", async () => {
    const item = await createServiceCatalogItem({ entityId: parentEntity.id, name: "Solicitud de laptop" });
    itemIds.push(item.id);

    expect(item.ticketType).toBe("request");
    expect(item.isActive).toBe(true);
    expect(item.sortOrder).toBe(0);

    const fetched = await getServiceCatalogItem(item.id);
    expect(fetched?.id).toBe(item.id);
  });

  it("listServiceCatalogItems only returns active items by default", async () => {
    const active = await createServiceCatalogItem({ entityId: parentEntity.id, name: "Activo" });
    itemIds.push(active.id);
    const toDeactivate = await createServiceCatalogItem({ entityId: parentEntity.id, name: "Sera desactivado" });
    itemIds.push(toDeactivate.id);
    await updateServiceCatalogItem(toDeactivate.id, { isActive: false });

    const onlyActive = await listServiceCatalogItems(parentEntity.id);
    expect(onlyActive.map((i) => i.id)).toContain(active.id);
    expect(onlyActive.map((i) => i.id)).not.toContain(toDeactivate.id);

    const everything = await listServiceCatalogItems(parentEntity.id, { onlyActive: false });
    expect(everything.map((i) => i.id)).toContain(toDeactivate.id);
  });

  it("subtree visibility: an item in a child entity is only visible from the parent with includeSubtree", async () => {
    const inChild = await createServiceCatalogItem({ entityId: childEntity.id, name: "Solo en hijo" });
    itemIds.push(inChild.id);

    const fromParentDirect = await listServiceCatalogItems(parentEntity.id);
    expect(fromParentDirect.map((i) => i.id)).not.toContain(inChild.id);

    const fromParentSubtree = await listServiceCatalogItems(parentEntity.id, { includeSubtree: true });
    expect(fromParentSubtree.map((i) => i.id)).toContain(inChild.id);
  });

  it("updateServiceCatalogItem updates fields and orders by sortOrder then name", async () => {
    const item = await createServiceCatalogItem({ entityId: parentEntity.id, name: "Original", sortOrder: 5 });
    itemIds.push(item.id);

    const updated = await updateServiceCatalogItem(item.id, { name: "Renombrado", sortOrder: 1 });
    expect(updated.name).toBe("Renombrado");
    expect(updated.sortOrder).toBe(1);
  });

  it("throws when updating a nonexistent catalog item", async () => {
    await expect(updateServiceCatalogItem("00000000-0000-0000-0000-000000000000", { name: "x" })).rejects.toThrow();
  });
});
