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
import { z } from "zod";

/**
 * `schema.parse()` throws a `ZodError` whose `.message` getter is a JSON blob
 * (see zod's ZodError#message), not a human-readable string. Every setup form
 * surfaces server-action errors via `err.message`, so parsing this way turns
 * validation failures into unreadable JSON dumped in the UI. Use `.safeParse`
 * instead and rethrow a clean, semicolon-joined message.
 */
function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

export async function createAssetDefinitionAction(input: {
  key: string;
  name: string;
  icon?: string | null;
  isSystem?: boolean;
  hasExtensionTable?: boolean;
}) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_ASSET_DEFINITION, RIGHT.CREATE);
  const parsed = parseInput(createAssetDefinitionSchema, input);
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
  const parsed = parseInput(createAssetFieldDefinitionSchema, input);
  const field = await createAssetFieldDefinition(parsed);
  revalidatePath(`/setup/asset-definitions/${parsed.assetDefinitionId}`);
  return field;
}
