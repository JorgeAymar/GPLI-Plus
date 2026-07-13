import { assets, db, type Asset } from "@itsm/db";
import { and, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import { recordAuditLog } from "../audit/audit-service";
import { listSubtree } from "../entities/entity-service";
import type { CreateAssetInput } from "../validation/asset.zod";
import { raiseWebhookEvent } from "../webhooks/webhook-service";
import { validateCustomFields } from "./dynamic-schema";

export async function createAsset(input: CreateAssetInput, actorUserId: string | null): Promise<Asset> {
  const validatedCustomFields = await validateCustomFields(input.assetDefinitionId, input.customFields);

  const [created] = await db
    .insert(assets)
    .values({
      entityId: input.entityId,
      assetDefinitionId: input.assetDefinitionId,
      name: input.name,
      serialNumber: input.serialNumber ?? null,
      inventoryNumber: input.inventoryNumber ?? null,
      statusDropdownItemId: input.statusDropdownItemId ?? null,
      manufacturerDropdownItemId: input.manufacturerDropdownItemId ?? null,
      modelDropdownItemId: input.modelDropdownItemId ?? null,
      locationDropdownItemId: input.locationDropdownItemId ?? null,
      userId: input.userId ?? null,
      groupId: input.groupId ?? null,
      comment: input.comment ?? null,
      customFields: validatedCustomFields,
    })
    .returning();
  if (!created) throw new Error("Failed to insert asset");

  await recordAuditLog({
    entityId: created.entityId,
    actorUserId,
    action: "create",
    objectType: "asset",
    objectId: created.id,
    after: created,
  });

  await raiseWebhookEvent("asset", "create", created.entityId, created).catch(() => {});

  return created;
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  return asset;
}

export async function listAssets(
  entityId: string,
  options?: { assetDefinitionId?: string; search?: string; includeSubtree?: boolean; includeDeleted?: boolean },
): Promise<Asset[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];

  const conditions: SQL[] = [inArray(assets.entityId, entityIds)];
  if (!options?.includeDeleted) conditions.push(isNull(assets.deletedAt));
  if (options?.assetDefinitionId) conditions.push(eq(assets.assetDefinitionId, options.assetDefinitionId));
  if (options?.search) {
    const pattern = `%${options.search}%`;
    const searchCondition = or(ilike(assets.name, pattern), ilike(assets.serialNumber, pattern), ilike(assets.inventoryNumber, pattern));
    if (searchCondition) conditions.push(searchCondition);
  }

  return db
    .select()
    .from(assets)
    .where(and(...conditions))
    .orderBy(assets.name);
}

export async function updateAsset(
  id: string,
  input: Partial<Omit<CreateAssetInput, "entityId" | "assetDefinitionId">>,
  actorUserId: string | null,
): Promise<Asset> {
  const before = await getAsset(id);
  if (!before) throw new Error(`Asset ${id} not found`);

  const customFields =
    input.customFields !== undefined ? await validateCustomFields(before.assetDefinitionId, input.customFields) : undefined;

  const [updated] = await db
    .update(assets)
    .set({ ...input, customFields, updatedAt: new Date() })
    .where(eq(assets.id, id))
    .returning();
  if (!updated) throw new Error(`Asset ${id} not found`);

  await recordAuditLog({
    entityId: updated.entityId,
    actorUserId,
    action: "update",
    objectType: "asset",
    objectId: updated.id,
    before,
    after: updated,
  });

  await raiseWebhookEvent("asset", "update", updated.entityId, updated).catch(() => {});

  return updated;
}

/** Separate from updateAsset so RIGHT.ASSIGN (not RIGHT.UPDATE) gates it. */
export async function assignAsset(
  id: string,
  input: { userId?: string | null; groupId?: string | null },
  actorUserId: string | null,
): Promise<Asset> {
  const before = await getAsset(id);
  if (!before) throw new Error(`Asset ${id} not found`);

  const [updated] = await db
    .update(assets)
    .set({ userId: input.userId ?? null, groupId: input.groupId ?? null, updatedAt: new Date() })
    .where(eq(assets.id, id))
    .returning();
  if (!updated) throw new Error(`Asset ${id} not found`);

  await recordAuditLog({
    entityId: updated.entityId,
    actorUserId,
    action: "assign",
    objectType: "asset",
    objectId: updated.id,
    before,
    after: updated,
  });

  return updated;
}

/** RIGHT.DELETE - moves the asset to trash without removing the row. */
export async function softDeleteAsset(id: string, actorUserId: string | null): Promise<Asset> {
  const before = await getAsset(id);
  if (!before) throw new Error(`Asset ${id} not found`);

  const [updated] = await db.update(assets).set({ deletedAt: new Date() }).where(eq(assets.id, id)).returning();
  if (!updated) throw new Error(`Asset ${id} not found`);

  await recordAuditLog({ entityId: updated.entityId, actorUserId, action: "delete", objectType: "asset", objectId: updated.id, before });

  return updated;
}

export async function restoreAsset(id: string, actorUserId: string | null): Promise<Asset> {
  const [updated] = await db.update(assets).set({ deletedAt: null }).where(eq(assets.id, id)).returning();
  if (!updated) throw new Error(`Asset ${id} not found`);

  await recordAuditLog({ entityId: updated.entityId, actorUserId, action: "restore", objectType: "asset", objectId: updated.id });

  return updated;
}

/** RIGHT.PURGE - hard delete, unrecoverable. */
export async function purgeAsset(id: string, actorUserId: string | null): Promise<void> {
  const before = await getAsset(id);
  if (!before) throw new Error(`Asset ${id} not found`);

  await db.delete(assets).where(eq(assets.id, id));

  await recordAuditLog({ entityId: before.entityId, actorUserId, action: "purge", objectType: "asset", objectId: id, before });
}
