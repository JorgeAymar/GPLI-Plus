"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  addConsumableUnits,
  addConsumableUnitsSchema,
  createConsumableItem,
  createConsumableItemSchema,
  requireRight,
  retireConsumable,
  useConsumable as markConsumableInUse,
  useConsumableSchema,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createConsumableItemAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONSUMABLE, RIGHT.CREATE);
  const parsed = createConsumableItemSchema.parse(input);
  const item = await createConsumableItem(parsed);
  revalidatePath("/management/consumables");
  return item;
}

export async function addConsumableUnitsAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONSUMABLE, RIGHT.CREATE);
  const parsed = addConsumableUnitsSchema.parse(input);
  const units = await addConsumableUnits(parsed.consumableItemId, parsed.quantity);
  revalidatePath(`/management/consumables/${parsed.consumableItemId}`);
  return units;
}

export async function useConsumableAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONSUMABLE, RIGHT.UPDATE);
  const parsed = useConsumableSchema.parse(input);
  const updated = await markConsumableInUse(parsed.id, parsed.assignedAssetId);
  revalidatePath(`/management/consumables/${updated.consumableItemId}`);
  return updated;
}

export async function retireConsumableAction(consumableItemId: string, id: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONSUMABLE, RIGHT.UPDATE);
  const updated = await retireConsumable(id);
  revalidatePath(`/management/consumables/${consumableItemId}`);
  return updated;
}
