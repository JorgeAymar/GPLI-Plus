import { eq, sql } from "drizzle-orm";
import { db, entities, type Entity } from "@itsm/db";

/** ltree labels only allow letters/digits/underscores - UUIDs use hyphens, so sanitize. */
function toLabel(id: string): string {
  return id.replace(/-/g, "_");
}

export async function getEntity(entityId: string): Promise<Entity | undefined> {
  const [entity] = await db.select().from(entities).where(eq(entities.id, entityId));
  return entity;
}

/** Every entity, root-to-leaf - callers nest it into a tree using parentId. */
export async function listAllEntities(): Promise<Entity[]> {
  return db.select().from(entities).orderBy(entities.level, entities.name);
}

export async function createEntity(input: {
  name: string;
  parentId?: string | null;
  comment?: string | null;
}): Promise<Entity> {
  return db.transaction(async (tx) => {
    let parentPath = "";
    let level = 0;

    if (input.parentId) {
      const [parent] = await tx.select().from(entities).where(eq(entities.id, input.parentId));
      if (!parent) throw new Error(`Parent entity ${input.parentId} not found`);
      parentPath = parent.path;
      level = parent.level + 1;
    }

    // Path depends on the row's own generated id, so insert with a placeholder then correct it.
    const [created] = await tx
      .insert(entities)
      .values({
        name: input.name,
        parentId: input.parentId ?? null,
        path: "pending",
        level,
        comment: input.comment ?? null,
      })
      .returning();
    if (!created) throw new Error("Failed to insert entity");

    const ownLabel = toLabel(created.id);
    const fullPath = parentPath ? `${parentPath}.${ownLabel}` : ownLabel;

    const [updated] = await tx.update(entities).set({ path: fullPath }).where(eq(entities.id, created.id)).returning();
    if (!updated) throw new Error("Failed to update entity path");

    return updated;
  });
}

/** All descendants (including the entity itself), ordered root-to-leaf. */
export async function listSubtree(entityId: string): Promise<Entity[]> {
  const root = await getEntity(entityId);
  if (!root) throw new Error(`Entity ${entityId} not found`);
  return db
    .select()
    .from(entities)
    .where(sql`${entities.path} <@ ${root.path}::ltree`)
    .orderBy(entities.level, entities.name);
}

/** All ancestors (including the entity itself), ordered root-to-leaf. */
export async function listAncestors(entityId: string): Promise<Entity[]> {
  const node = await getEntity(entityId);
  if (!node) throw new Error(`Entity ${entityId} not found`);
  return db
    .select()
    .from(entities)
    .where(sql`${entities.path} @> ${node.path}::ltree`)
    .orderBy(entities.level);
}

export async function moveEntity(entityId: string, newParentId: string | null): Promise<Entity> {
  return db.transaction(async (tx) => {
    const [node] = await tx.select().from(entities).where(eq(entities.id, entityId));
    if (!node) throw new Error(`Entity ${entityId} not found`);

    let newParentPath = "";
    let newLevel = 0;
    if (newParentId) {
      const [parent] = await tx.select().from(entities).where(eq(entities.id, newParentId));
      if (!parent) throw new Error(`Parent entity ${newParentId} not found`);
      if (parent.path === node.path || parent.path.startsWith(`${node.path}.`)) {
        throw new Error("Cannot move an entity into its own subtree");
      }
      newParentPath = parent.path;
      newLevel = parent.level + 1;
    }

    const ownLabel = toLabel(node.id);
    const newPath = newParentPath ? `${newParentPath}.${ownLabel}` : ownLabel;
    const levelDelta = newLevel - node.level;
    const oldPath = node.path;

    const descendants = await tx
      .select()
      .from(entities)
      .where(sql`${entities.path} <@ ${oldPath}::ltree`);

    for (const d of descendants) {
      const isNodeItself = d.id === node.id;
      const rewrittenPath = isNodeItself ? newPath : newPath + d.path.slice(oldPath.length);
      await tx
        .update(entities)
        .set({
          path: rewrittenPath,
          level: d.level + levelDelta,
          ...(isNodeItself ? { parentId: newParentId } : {}),
        })
        .where(eq(entities.id, d.id));
    }

    const [updated] = await tx.select().from(entities).where(eq(entities.id, entityId));
    if (!updated) throw new Error(`Entity ${entityId} not found after move`);
    return updated;
  });
}
