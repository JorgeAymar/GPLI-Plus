"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createAssetDefinition,
  createAssetDefinitionSchema,
  createAssetFieldDefinition,
  createAssetFieldDefinitionSchema,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createAssetDefinitionAction(input: {
  key: string;
  name: string;
  icon?: string | null;
  isSystem?: boolean;
  hasExtensionTable?: boolean;
}) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_ASSET_DEFINITION, RIGHT.CREATE);
  const parsed = createAssetDefinitionSchema.parse(input);
  const definition = await createAssetDefinition(parsed);
  revalidatePath("/setup/asset-definitions");
  return definition;
}

export async function createAssetFieldDefinitionAction(input: {
  assetDefinitionId: string;
  key: string;
  label: string;
  fieldType: "text" | "textarea" | "number" | "boolean" | "date" | "dropdown";
  dropdownCategoryId?: string | null;
  isRequired?: boolean;
  defaultValue?: string | null;
  sortOrder?: number;
}) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_ASSET_DEFINITION, RIGHT.CREATE);
  const parsed = createAssetFieldDefinitionSchema.parse(input);
  const field = await createAssetFieldDefinition(parsed);
  revalidatePath(`/setup/asset-definitions/${parsed.assetDefinitionId}`);
  return field;
}
