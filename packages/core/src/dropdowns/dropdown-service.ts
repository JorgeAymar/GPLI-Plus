import { db, dropdownCategories, dropdownItems, type DropdownCategory, type DropdownItem } from "@itsm/db";
import { and, eq, inArray } from "drizzle-orm";
import { listAncestors } from "../entities/entity-service";

export async function createDropdownCategory(input: { key: string; name: string; isSystem?: boolean }): Promise<DropdownCategory> {
  const [created] = await db
    .insert(dropdownCategories)
    .values({ key: input.key, name: input.name, isSystem: input.isSystem ?? false })
    .returning();
  if (!created) throw new Error("Failed to insert dropdown category");
  return created;
}

export async function listDropdownCategories(): Promise<DropdownCategory[]> {
  return db.select().from(dropdownCategories).orderBy(dropdownCategories.name);
}

export async function getDropdownCategoryByKey(key: string): Promise<DropdownCategory | undefined> {
  const [category] = await db.select().from(dropdownCategories).where(eq(dropdownCategories.key, key));
  return category;
}

export async function getDropdownCategory(id: string): Promise<DropdownCategory | undefined> {
  const [category] = await db.select().from(dropdownCategories).where(eq(dropdownCategories.id, id));
  return category;
}

export async function createDropdownItem(input: {
  categoryId: string;
  entityId: string;
  parentId?: string | null;
  name: string;
  comment?: string | null;
}): Promise<DropdownItem> {
  const [created] = await db
    .insert(dropdownItems)
    .values({
      categoryId: input.categoryId,
      entityId: input.entityId,
      parentId: input.parentId ?? null,
      name: input.name,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert dropdown item");
  return created;
}

/** Items visible from `entityId`: those created at it or any of its ancestors (see schema comment on dropdownItems). */
export async function listDropdownItems(categoryId: string, entityId: string): Promise<DropdownItem[]> {
  const ancestors = await listAncestors(entityId);
  const ancestorIds = ancestors.map((a) => a.id);
  return db
    .select()
    .from(dropdownItems)
    .where(and(eq(dropdownItems.categoryId, categoryId), inArray(dropdownItems.entityId, ancestorIds)));
}

export async function updateDropdownItem(
  id: string,
  input: Partial<{ name: string; comment: string | null; isActive: boolean }>,
): Promise<DropdownItem> {
  const [updated] = await db.update(dropdownItems).set(input).where(eq(dropdownItems.id, id)).returning();
  if (!updated) throw new Error(`Dropdown item ${id} not found`);
  return updated;
}
