import { eq } from "drizzle-orm";
import {
  assetDefinitions,
  assetFieldDefinitions,
  db,
  type AssetDefinition,
  type AssetFieldDefinition,
  type AssetFieldType,
} from "@itsm/db";
import { MODULE } from "../auth/modules";
import { ASSET_DEFINITION_KEY } from "./asset-definition-keys";

export async function createAssetDefinition(input: {
  key: string;
  name: string;
  icon?: string | null;
  isSystem?: boolean;
  hasExtensionTable?: boolean;
}): Promise<AssetDefinition> {
  let created: AssetDefinition | undefined;
  try {
    [created] = await db
      .insert(assetDefinitions)
      .values({
        key: input.key,
        name: input.name,
        icon: input.icon ?? null,
        isSystem: input.isSystem ?? false,
        hasExtensionTable: input.hasExtensionTable ?? false,
      })
      .returning();
  } catch (err) {
    // See user-service.ts's createUser for why this must be caught here:
    // Drizzle wraps the real node-postgres error (with raw query text) in
    // `.cause`; `23505` is Postgres's unique_violation SQLSTATE.
    const cause = err instanceof Error ? err.cause : undefined;
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505") {
      const constraint = "constraint" in cause ? cause.constraint : undefined;
      if (constraint === "asset_definitions_key_unique") throw new Error("Ya existe un tipo de activo con esa clave (key).");
      throw new Error("Ya existe un tipo de activo con esos datos.");
    }
    throw new Error("No se pudo crear el tipo de activo.");
  }
  if (!created) throw new Error("No se pudo crear el tipo de activo.");
  return created;
}

export async function listAssetDefinitions(): Promise<AssetDefinition[]> {
  return db.select().from(assetDefinitions).orderBy(assetDefinitions.name);
}

export async function getAssetDefinition(id: string): Promise<AssetDefinition | undefined> {
  const [def] = await db.select().from(assetDefinitions).where(eq(assetDefinitions.id, id));
  return def;
}

export async function getAssetDefinitionByKey(key: string): Promise<AssetDefinition | undefined> {
  const [def] = await db.select().from(assetDefinitions).where(eq(assetDefinitions.key, key));
  return def;
}

export async function updateAssetDefinition(
  id: string,
  input: Partial<{ name: string; icon: string | null; hasExtensionTable: boolean; isActive: boolean }>,
): Promise<AssetDefinition> {
  const [updated] = await db.update(assetDefinitions).set(input).where(eq(assetDefinitions.id, id)).returning();
  if (!updated) throw new Error(`Asset definition ${id} not found`);
  return updated;
}

export async function createAssetFieldDefinition(input: {
  assetDefinitionId: string;
  key: string;
  label: string;
  fieldType: AssetFieldType;
  dropdownCategoryId?: string | null;
  isRequired?: boolean;
  defaultValue?: string | null;
  sortOrder?: number;
}): Promise<AssetFieldDefinition> {
  let created: AssetFieldDefinition | undefined;
  try {
    [created] = await db
      .insert(assetFieldDefinitions)
      .values({
        assetDefinitionId: input.assetDefinitionId,
        key: input.key,
        label: input.label,
        fieldType: input.fieldType,
        dropdownCategoryId: input.dropdownCategoryId ?? null,
        isRequired: input.isRequired ?? false,
        defaultValue: input.defaultValue ?? null,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
  } catch (err) {
    // `asset_field_def_unique_key` is a unique INDEX (not a named table
    // constraint), but Postgres still reports unique_violation (23505)
    // against it the same way - see migrations/0001_narrow_vargas.sql.
    const cause = err instanceof Error ? err.cause : undefined;
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505") {
      const constraint = "constraint" in cause ? cause.constraint : undefined;
      if (constraint === "asset_field_def_unique_key") throw new Error("Ya existe un campo con esa clave (key) en este tipo de activo.");
      throw new Error("Ya existe un campo con esos datos.");
    }
    throw new Error("No se pudo crear el campo.");
  }
  if (!created) throw new Error("No se pudo crear el campo.");
  return created;
}

export async function listAssetFieldDefinitions(assetDefinitionId: string): Promise<AssetFieldDefinition[]> {
  return db
    .select()
    .from(assetFieldDefinitions)
    .where(eq(assetFieldDefinitions.assetDefinitionId, assetDefinitionId))
    .orderBy(assetFieldDefinitions.sortOrder);
}

export async function deleteAssetFieldDefinition(id: string): Promise<void> {
  await db.delete(assetFieldDefinitions).where(eq(assetFieldDefinitions.id, id));
}

/** Known core types get their own dedicated RBAC module key; custom admin-created types share ASSETS_GENERIC. */
export function moduleKeyForAssetDefinition(def: Pick<AssetDefinition, "key" | "isSystem">): string {
  if (!def.isSystem) return MODULE.ASSETS_GENERIC;
  const known: Record<string, string> = {
    [ASSET_DEFINITION_KEY.COMPUTER]: MODULE.ASSETS_COMPUTER,
    [ASSET_DEFINITION_KEY.NETWORK_EQUIPMENT]: MODULE.ASSETS_NETWORK_EQUIPMENT,
    [ASSET_DEFINITION_KEY.MONITOR]: MODULE.ASSETS_MONITOR,
    [ASSET_DEFINITION_KEY.PRINTER]: MODULE.ASSETS_PRINTER,
    [ASSET_DEFINITION_KEY.PHONE]: MODULE.ASSETS_PHONE,
    [ASSET_DEFINITION_KEY.PERIPHERAL]: MODULE.ASSETS_PERIPHERAL,
    [ASSET_DEFINITION_KEY.DATACENTER]: MODULE.MANAGEMENT_DATACENTER,
    [ASSET_DEFINITION_KEY.DOMAIN]: MODULE.MANAGEMENT_DOMAIN,
    [ASSET_DEFINITION_KEY.LINE]: MODULE.MANAGEMENT_LINE,
    [ASSET_DEFINITION_KEY.DATABASE]: MODULE.MANAGEMENT_DATABASE,
  };
  return known[def.key] ?? MODULE.ASSETS_GENERIC;
}
