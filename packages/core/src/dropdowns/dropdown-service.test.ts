import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db, dropdownCategories, dropdownItems, entities } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createDropdownCategorySchema, createDropdownItemSchema } from "../validation/dropdown.zod";
import {
  createDropdownCategory,
  createDropdownItem,
  getDropdownCategory,
  getDropdownCategoryByKey,
  listDropdownCategories,
  listDropdownItems,
  updateDropdownItem,
} from "./dropdown-service";

const PREFIX = "__vitest_platform__";

describe("dropdown-service", () => {
  let rootEntityId: string;
  let childEntityId: string;
  let categoryId: string;
  const categoryKey = `${PREFIX}category_${randomUUID().replace(/-/g, "")}`;

  beforeAll(async () => {
    const root = await createEntity({ name: `${PREFIX}dropdown_root_${randomUUID()}` });
    rootEntityId = root.id;
    const child = await createEntity({ name: `${PREFIX}dropdown_child_${randomUUID()}`, parentId: root.id });
    childEntityId = child.id;

    const category = await createDropdownCategory({ key: categoryKey, name: "Vitest Category" });
    categoryId = category.id;
  });

  afterAll(async () => {
    await db.delete(dropdownItems).where(eq(dropdownItems.categoryId, categoryId));
    await db.delete(dropdownCategories).where(eq(dropdownCategories.id, categoryId));
    // Child before root: entities.parentId has no ON DELETE CASCADE.
    await db.delete(entities).where(eq(entities.id, childEntityId));
    await db.delete(entities).where(eq(entities.id, rootEntityId));
  });

  it("createDropdownCategory + getDropdownCategoryByKey / getDropdownCategory round-trip", async () => {
    const byKey = await getDropdownCategoryByKey(categoryKey);
    expect(byKey?.id).toBe(categoryId);

    const byId = await getDropdownCategory(categoryId);
    expect(byId?.key).toBe(categoryKey);
  });

  it("listDropdownCategories includes the created category", async () => {
    const categories = await listDropdownCategories();
    expect(categories.some((c) => c.id === categoryId)).toBe(true);
  });

  it("listDropdownItems returns items visible from ancestors, but not from descendants", async () => {
    const itemAtRoot = await createDropdownItem({ categoryId, entityId: rootEntityId, name: "Item at root" });
    const itemAtChild = await createDropdownItem({ categoryId, entityId: childEntityId, name: "Item at child" });

    const visibleFromChild = await listDropdownItems(categoryId, childEntityId);
    expect(visibleFromChild.map((i) => i.id).sort()).toEqual([itemAtRoot.id, itemAtChild.id].sort());

    const visibleFromRoot = await listDropdownItems(categoryId, rootEntityId);
    expect(visibleFromRoot.map((i) => i.id)).toEqual([itemAtRoot.id]);
  });

  it("updateDropdownItem patches name/comment/isActive", async () => {
    const item = await createDropdownItem({ categoryId, entityId: rootEntityId, name: "Before" });
    const updated = await updateDropdownItem(item.id, { name: "After", comment: "a comment", isActive: false });

    expect(updated.name).toBe("After");
    expect(updated.comment).toBe("a comment");
    expect(updated.isActive).toBe(false);
  });

  it("updateDropdownItem throws for a non-existent id", async () => {
    await expect(updateDropdownItem(randomUUID(), { name: "x" })).rejects.toThrow();
  });

  describe("dropdown zod schemas", () => {
    it("createDropdownCategorySchema rejects an uppercase/invalid key", () => {
      expect(createDropdownCategorySchema.safeParse({ key: "Invalid-Key", name: "x" }).success).toBe(false);
      expect(createDropdownCategorySchema.safeParse({ key: "valid_key_1", name: "x" }).success).toBe(true);
    });

    it("createDropdownItemSchema requires uuid categoryId/entityId and a non-empty name", () => {
      expect(
        createDropdownItemSchema.safeParse({ categoryId: randomUUID(), entityId: randomUUID(), name: "OK" }).success,
      ).toBe(true);
      expect(createDropdownItemSchema.safeParse({ categoryId: "not-a-uuid", entityId: randomUUID(), name: "OK" }).success).toBe(
        false,
      );
      expect(createDropdownItemSchema.safeParse({ categoryId: randomUUID(), entityId: randomUUID(), name: "" }).success).toBe(
        false,
      );
    });
  });
});
