"use server";

import { requireAuthContext } from "@/lib/session";
import {
  RIGHT,
  assignAsset,
  assignAssetSchema,
  createAsset,
  createAssetSchema,
  getAsset,
  getAssetDefinition,
  moduleKeyForAssetDefinition,
  purgeAsset,
  requireRight,
  requireRightOnEntity,
  restoreAsset,
  softDeleteAsset,
  updateAsset,
  updateAssetSchema,
  type AuthContext,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

async function requireRightForAssetDefinition(assetDefinitionId: string, required: number): Promise<AuthContext> {
  const context = await requireAuthContext();
  const definition = await getAssetDefinition(assetDefinitionId);
  if (!definition) throw new Error(`Asset definition ${assetDefinitionId} not found`);
  await requireRight(context, moduleKeyForAssetDefinition(definition), required);
  return context;
}

/**
 * Unlike requireRightForAssetDefinition (used only for CREATE, where the asset doesn't exist
 * yet), this checks the right against the EXISTING asset's own entity rather than the
 * caller's active entity - see requireTicketRight in tickets.actions.ts for why. Used for
 * every action on an already-existing asset (update/assign/delete/restore/purge).
 */
async function requireRightForAsset(assetId: string, required: number): Promise<AuthContext> {
  const context = await requireAuthContext();
  const asset = await getAsset(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  const definition = await getAssetDefinition(asset.assetDefinitionId);
  if (!definition) throw new Error(`Asset definition ${asset.assetDefinitionId} not found`);
  await requireRightOnEntity(context, moduleKeyForAssetDefinition(definition), required, asset.entityId);
  return context;
}

export async function createAssetAction(input: unknown) {
  const parsed = createAssetSchema.parse(input);
  const context = await requireRightForAssetDefinition(parsed.assetDefinitionId, RIGHT.CREATE);
  const asset = await createAsset(parsed, context.user.id);
  revalidatePath("/assets");
  // The create form for generic asset types lives on /assets/[assetType] (see
  // app/(central)/assets/[assetType]/page.tsx), not on /assets - without this,
  // the "Instancias existentes" list on that page stays stale after creating
  // a new instance, since revalidatePath only refreshes the exact path given.
  const definition = await getAssetDefinition(parsed.assetDefinitionId);
  if (definition) revalidatePath(`/assets/${definition.key}`);
  return asset;
}

export async function updateAssetAction(id: string, input: unknown) {
  const parsed = updateAssetSchema.parse(input);
  const context = await requireRightForAsset(id, RIGHT.UPDATE);
  const asset = await updateAsset(id, parsed, context.user.id);
  revalidatePath("/assets");
  return asset;
}

export async function assignAssetAction(id: string, input: unknown) {
  const parsed = assignAssetSchema.parse(input);
  const context = await requireRightForAsset(id, RIGHT.ASSIGN);
  const asset = await assignAsset(id, parsed, context.user.id);
  revalidatePath("/assets");
  return asset;
}

export async function softDeleteAssetAction(id: string) {
  const context = await requireRightForAsset(id, RIGHT.DELETE);
  const asset = await softDeleteAsset(id, context.user.id);
  revalidatePath("/assets");
  return asset;
}

export async function restoreAssetAction(id: string) {
  const context = await requireRightForAsset(id, RIGHT.DELETE);
  const asset = await restoreAsset(id, context.user.id);
  revalidatePath("/assets");
  return asset;
}

export async function purgeAssetAction(id: string) {
  const context = await requireRightForAsset(id, RIGHT.PURGE);
  await purgeAsset(id, context.user.id);
  revalidatePath("/assets");
}
