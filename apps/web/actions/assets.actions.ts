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

async function requireRightForAsset(assetId: string, required: number): Promise<AuthContext> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  return requireRightForAssetDefinition(asset.assetDefinitionId, required);
}

export async function createAssetAction(input: unknown) {
  const parsed = createAssetSchema.parse(input);
  const context = await requireRightForAssetDefinition(parsed.assetDefinitionId, RIGHT.CREATE);
  const asset = await createAsset(parsed, context.user.id);
  revalidatePath("/assets");
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
