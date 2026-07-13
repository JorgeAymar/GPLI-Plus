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

export async function createAssetDefinition(input: {
  key: string;
  name: string;
  icon?: string | null;
  isSystem?: boolean;
  hasExtensionTable?: boolean;
}): Promise<AssetDefinition> {
  const [created] = await db
    .insert(assetDefinitions)
    .values({
      key: input.key,
      name: input.name,
      icon: input.icon ?? null,
      isSystem: input.isSystem ?? false,
      hasExtensionTable: input.hasExtensionTable ?? false,
    })
    .returning();
  if (!created) throw new Error("Failed to insert asset definition");
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
  const [created] = await db
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
  if (!created) throw new Error("Failed to insert asset field definition");
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
    computer: MODULE.ASSETS_COMPUTER,
    network_equipment: MODULE.ASSETS_NETWORK_EQUIPMENT,
    monitor: MODULE.ASSETS_MONITOR,
    printer: MODULE.ASSETS_PRINTER,
    phone: MODULE.ASSETS_PHONE,
    peripheral: MODULE.ASSETS_PERIPHERAL,
    datacenter: MODULE.MANAGEMENT_DATACENTER,
    domain: MODULE.MANAGEMENT_DOMAIN,
    line: MODULE.MANAGEMENT_LINE,
    database: MODULE.MANAGEMENT_DATABASE,
  };
  return known[def.key] ?? MODULE.ASSETS_GENERIC;
}
