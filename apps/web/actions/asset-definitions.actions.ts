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
import type { AssetDefinition, AssetFieldDefinition } from "@itsm/db";
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

export interface CreateAssetDefinitionResult {
  definition?: AssetDefinition;
  error?: string;
}

/**
 * Returns `{error}` instead of throwing on a validation/uniqueness failure -
 * Next.js redacts thrown Server Action errors in production (see
 * users.actions.ts's createUserAction for the full explanation).
 */
export async function createAssetDefinitionAction(input: {
  key: string;
  name: string;
  icon?: string | null;
  isSystem?: boolean;
  hasExtensionTable?: boolean;
}): Promise<CreateAssetDefinitionResult> {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_ASSET_DEFINITION, RIGHT.CREATE);

  let definition: AssetDefinition;
  try {
    const parsed = parseInput(createAssetDefinitionSchema, input);
    definition = await createAssetDefinition(parsed);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear el tipo de activo." };
  }
  revalidatePath("/setup/asset-definitions");
  return { definition };
}

export interface CreateAssetFieldDefinitionResult {
  field?: AssetFieldDefinition;
  error?: string;
}

/** Same {error}-as-data pattern as createAssetDefinitionAction above. */
export async function createAssetFieldDefinitionAction(input: {
  assetDefinitionId: string;
  key: string;
  label: string;
  fieldType: "text" | "textarea" | "number" | "boolean" | "date" | "dropdown";
  dropdownCategoryId?: string | null;
  isRequired?: boolean;
  defaultValue?: string | null;
  sortOrder?: number;
}): Promise<CreateAssetFieldDefinitionResult> {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_ASSET_DEFINITION, RIGHT.CREATE);

  let field: AssetFieldDefinition;
  try {
    const parsed = parseInput(createAssetFieldDefinitionSchema, input);
    field = await createAssetFieldDefinition(parsed);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear el campo." };
  }
  revalidatePath(`/setup/asset-definitions/${input.assetDefinitionId}`);
  return { field };
}
