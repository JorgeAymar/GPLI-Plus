import { assets, db, networkEquipment, type Asset, type NetworkEquipment } from "@itsm/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { recordAuditLog } from "../audit/audit-service";
import { listSubtree } from "../entities/entity-service";
import type { CreateNetworkEquipmentInput } from "../validation/network-equipment.zod";
import { ASSET_DEFINITION_KEY } from "./asset-definition-keys";
import { getAssetDefinitionByKey } from "./asset-definition-service";
import { validateCustomFields } from "./dynamic-schema";

async function requireNetworkEquipmentDefinition() {
  const definition = await getAssetDefinitionByKey(ASSET_DEFINITION_KEY.NETWORK_EQUIPMENT);
  if (!definition) throw new Error('Asset definition "network_equipment" not found - run the seed script first');
  return definition;
}

export async function createNetworkEquipment(
  input: CreateNetworkEquipmentInput,
  actorUserId: string | null,
): Promise<{ asset: Asset; networkEquipment: NetworkEquipment }> {
  const definition = await requireNetworkEquipmentDefinition();
  const validatedCustomFields = await validateCustomFields(definition.id, input.customFields);

  return db.transaction(async (tx) => {
    const [asset] = await tx
      .insert(assets)
      .values({
        entityId: input.entityId,
        assetDefinitionId: definition.id,
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
    if (!asset) throw new Error("Failed to insert asset");

    const [equipment] = await tx
      .insert(networkEquipment)
      .values({
        assetId: asset.id,
        ipAddress: input.ipAddress ?? null,
        macAddress: input.macAddress ?? null,
        deviceTypeDropdownItemId: input.deviceTypeDropdownItemId ?? null,
        firmwareVersion: input.firmwareVersion ?? null,
        portsCount: input.portsCount ?? null,
      })
      .returning();
    if (!equipment) throw new Error("Failed to insert network equipment");

    await recordAuditLog({
      entityId: asset.entityId,
      actorUserId,
      action: "create",
      objectType: "asset",
      objectId: asset.id,
      after: { asset, networkEquipment: equipment },
    });

    return { asset, networkEquipment: equipment };
  });
}

export async function listNetworkEquipment(
  entityId: string,
  options?: { includeSubtree?: boolean },
): Promise<Array<Asset & NetworkEquipment>> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];

  const rows = await db
    .select()
    .from(assets)
    .innerJoin(networkEquipment, eq(networkEquipment.assetId, assets.id))
    .where(and(inArray(assets.entityId, entityIds), isNull(assets.deletedAt)))
    .orderBy(assets.name);

  return rows.map((r) => ({ ...r.assets, ...r.network_equipment }));
}

export async function getNetworkEquipmentWithAsset(assetId: string): Promise<{ asset: Asset; networkEquipment: NetworkEquipment } | undefined> {
  const [row] = await db
    .select()
    .from(assets)
    .innerJoin(networkEquipment, eq(networkEquipment.assetId, assets.id))
    .where(eq(assets.id, assetId));
  if (!row) return undefined;
  return { asset: row.assets, networkEquipment: row.network_equipment };
}
