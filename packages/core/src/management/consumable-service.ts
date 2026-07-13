import { consumableItems, consumables, db, type Consumable, type ConsumableItem } from "@itsm/db";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

export async function createConsumableItem(input: {
  entityId: string;
  name: string;
  supplierId?: string | null;
  alertThreshold?: number | null;
  comment?: string | null;
}): Promise<ConsumableItem> {
  const [created] = await db
    .insert(consumableItems)
    .values({
      entityId: input.entityId,
      name: input.name,
      supplierId: input.supplierId ?? null,
      alertThreshold: input.alertThreshold ?? null,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert consumable item");
  return created;
}

export async function listConsumableItems(entityId: string, options?: { includeSubtree?: boolean }): Promise<ConsumableItem[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(consumableItems)
    .where(and(inArray(consumableItems.entityId, entityIds), isNull(consumableItems.deletedAt)))
    .orderBy(consumableItems.name);
}

export async function getConsumableItem(id: string): Promise<ConsumableItem | undefined> {
  const [row] = await db.select().from(consumableItems).where(eq(consumableItems.id, id));
  return row;
}

/** Inserts `quantity` new physical units (status="new") for a consumableItem in a single statement. */
export async function addConsumableUnits(consumableItemId: string, quantity: number): Promise<Consumable[]> {
  const created = await db
    .insert(consumables)
    .values([...Array(quantity)].map(() => ({ consumableItemId })))
    .returning();
  return created;
}

export async function listConsumables(consumableItemId: string): Promise<Consumable[]> {
  return db
    .select()
    .from(consumables)
    .where(eq(consumables.consumableItemId, consumableItemId))
    .orderBy(asc(consumables.status), asc(consumables.createdAt));
}

export async function useConsumable(id: string, assignedAssetId: string): Promise<Consumable> {
  const [existing] = await db.select().from(consumables).where(eq(consumables.id, id));
  if (!existing) throw new Error(`Consumable ${id} not found`);
  if (existing.status !== "new") throw new Error(`Consumable ${id} is not available (status: ${existing.status})`);

  const [updated] = await db
    .update(consumables)
    .set({ status: "in_use", assignedAssetId, useDate: new Date() })
    .where(eq(consumables.id, id))
    .returning();
  if (!updated) throw new Error(`Consumable ${id} not found`);
  return updated;
}

export async function retireConsumable(id: string): Promise<Consumable> {
  const [updated] = await db.update(consumables).set({ status: "used" }).where(eq(consumables.id, id)).returning();
  if (!updated) throw new Error(`Consumable ${id} not found`);
  return updated;
}

/** Cheap COUNT(*) over units still in stock - no denormalized counter column. */
export async function countAvailable(consumableItemId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(consumables)
    .where(and(eq(consumables.consumableItemId, consumableItemId), eq(consumables.status, "new")));
  return row?.value ?? 0;
}

export async function isBelowAlertThreshold(consumableItemId: string): Promise<boolean> {
  const item = await getConsumableItem(consumableItemId);
  if (!item || item.alertThreshold === null || item.alertThreshold === undefined) return false;
  const available = await countAvailable(consumableItemId);
  return available < item.alertThreshold;
}
