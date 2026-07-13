import "dotenv/config";
import { db, entities, type Entity } from "@itsm/db";
import { desc, eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity, getEntity, listAllEntities, listAncestors, listSubtree, moveEntity } from "./entity-service";

const PREFIX = "__vitest_rbac__entity_svc_";

/** ltree labels only allow letters/digits/underscores - UUIDs use hyphens, so sanitize (mirrors entity-service.ts). */
function toLabel(id: string): string {
  return id.replace(/-/g, "_");
}

describe("entity-service", () => {
  let root: Entity;
  let childA: Entity;
  let childB: Entity;
  let grandchild: Entity;

  beforeAll(async () => {
    root = await createEntity({ name: `${PREFIX}root` });
    childA = await createEntity({ name: `${PREFIX}child_a`, parentId: root.id });
    childB = await createEntity({ name: `${PREFIX}child_b`, parentId: root.id });
    grandchild = await createEntity({ name: `${PREFIX}grandchild`, parentId: childA.id });
  });

  afterAll(async () => {
    // Delete deepest (highest level) rows first so self-referencing parent_id FKs never block deletion.
    const rows = await db
      .select({ id: entities.id })
      .from(entities)
      .where(like(entities.name, `${PREFIX}%`))
      .orderBy(desc(entities.level));
    for (const row of rows) {
      await db.delete(entities).where(eq(entities.id, row.id));
    }
  });

  describe("createEntity", () => {
    it("creates a root entity with its own ltree label as path and level 0", () => {
      expect(root.parentId).toBeNull();
      expect(root.level).toBe(0);
      expect(root.path).toBe(toLabel(root.id));
    });

    it("creates a child entity whose path nests under the parent's path", () => {
      expect(childA.parentId).toBe(root.id);
      expect(childA.level).toBe(1);
      expect(childA.path).toBe(`${root.path}.${toLabel(childA.id)}`);
    });

    it("creates a grandchild entity with level and path reflecting two levels of nesting", () => {
      expect(grandchild.parentId).toBe(childA.id);
      expect(grandchild.level).toBe(2);
      expect(grandchild.path).toBe(`${childA.path}.${toLabel(grandchild.id)}`);
    });

    it("throws when parentId does not reference an existing entity", async () => {
      await expect(createEntity({ name: `${PREFIX}orphan`, parentId: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow(
        /not found/i,
      );
    });
  });

  describe("getEntity", () => {
    it("returns the entity for a known id", async () => {
      const found = await getEntity(root.id);
      expect(found?.id).toBe(root.id);
    });

    it("returns undefined for an unknown id", async () => {
      const found = await getEntity("00000000-0000-0000-0000-000000000000");
      expect(found).toBeUndefined();
    });
  });

  describe("listSubtree", () => {
    it("returns the root plus every descendant, ordered root-to-leaf", async () => {
      const subtree = await listSubtree(root.id);
      const ids = subtree.map((e) => e.id);
      expect(ids).toEqual(expect.arrayContaining([root.id, childA.id, childB.id, grandchild.id]));
      expect(subtree.length).toBe(4);
      // root-to-leaf: level must be non-decreasing across the returned rows.
      for (let i = 1; i < subtree.length; i++) {
        expect(subtree[i]!.level).toBeGreaterThanOrEqual(subtree[i - 1]!.level);
      }
    });

    it("scoped to a mid-tree node, excludes siblings and includes only its own descendants", async () => {
      const subtree = await listSubtree(childA.id);
      const ids = subtree.map((e) => e.id).sort();
      expect(ids).toEqual([childA.id, grandchild.id].sort());
      expect(ids).not.toContain(childB.id);
    });

    it("for a leaf with no children, returns just itself", async () => {
      const subtree = await listSubtree(grandchild.id);
      expect(subtree.map((e) => e.id)).toEqual([grandchild.id]);
    });

    it("throws for an unknown entity id", async () => {
      await expect(listSubtree("00000000-0000-0000-0000-000000000000")).rejects.toThrow(/not found/i);
    });
  });

  describe("listAncestors", () => {
    it("returns the full chain from root to the node itself, root-to-leaf ordered", async () => {
      const ancestors = await listAncestors(grandchild.id);
      expect(ancestors.map((e) => e.id)).toEqual([root.id, childA.id, grandchild.id]);
    });

    it("for a root node, returns just itself", async () => {
      const ancestors = await listAncestors(root.id);
      expect(ancestors.map((e) => e.id)).toEqual([root.id]);
    });
  });

  describe("listAllEntities", () => {
    it("includes every entity created in this suite", async () => {
      const all = await listAllEntities();
      const ids = all.map((e) => e.id);
      expect(ids).toEqual(expect.arrayContaining([root.id, childA.id, childB.id, grandchild.id]));
    });
  });

  describe("moveEntity", () => {
    it("rejects moving an entity into its own subtree (self)", async () => {
      await expect(moveEntity(root.id, root.id)).rejects.toThrow(/own subtree/i);
    });

    it("rejects moving an entity into one of its own descendants", async () => {
      await expect(moveEntity(root.id, grandchild.id)).rejects.toThrow(/own subtree/i);
      await expect(moveEntity(childA.id, grandchild.id)).rejects.toThrow(/own subtree/i);
    });

    it("throws for an unknown entityId", async () => {
      await expect(moveEntity("00000000-0000-0000-0000-000000000000", null)).rejects.toThrow(/not found/i);
    });

    it("throws for an unknown newParentId", async () => {
      await expect(moveEntity(childB.id, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(/not found/i);
    });

    it("moves a leaf under a new parent, rewriting its path and level, and updates descendants recursively", async () => {
      // childA (with descendant `grandchild`) moves from under root to under childB.
      const moved = await moveEntity(childA.id, childB.id);
      expect(moved.parentId).toBe(childB.id);
      expect(moved.level).toBe(childB.level + 1);
      expect(moved.path).toBe(`${childB.path}.${toLabel(childA.id)}`);

      const movedGrandchild = await getEntity(grandchild.id);
      expect(movedGrandchild?.level).toBe(moved.level + 1);
      expect(movedGrandchild?.path).toBe(`${moved.path}.${toLabel(grandchild.id)}`);
    });

    it("moves an entity back to top-level (null parent), resetting level to 0 and path to its own label", async () => {
      const moved = await moveEntity(childA.id, null);
      expect(moved.parentId).toBeNull();
      expect(moved.level).toBe(0);
      expect(moved.path).toBe(toLabel(childA.id));

      const movedGrandchild = await getEntity(grandchild.id);
      expect(movedGrandchild?.level).toBe(1);
      expect(movedGrandchild?.path).toBe(`${moved.path}.${toLabel(grandchild.id)}`);
    });
  });
});
