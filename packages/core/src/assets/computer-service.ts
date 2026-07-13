import {
  assetComponents,
  assets,
  computers,
  db,
  type Asset,
  type AssetComponent,
  type AssetComponentType,
  type Computer,
} from "@itsm/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { recordAuditLog } from "../audit/audit-service";
import { listSubtree } from "../entities/entity-service";
import type { CreateComputerInput } from "../validation/computer.zod";
import { getAssetDefinitionByKey } from "./asset-definition-service";
import { validateCustomFields } from "./dynamic-schema";

async function requireComputerDefinition() {
  const definition = await getAssetDefinitionByKey("computer");
  if (!definition) throw new Error('Asset definition "computer" not found - run the seed script first');
  return definition;
}

export async function createComputer(
  input: CreateComputerInput,
  actorUserId: string | null,
): Promise<{ asset: Asset; computer: Computer }> {
  const definition = await requireComputerDefinition();
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

    const [computer] = await tx
      .insert(computers)
      .values({
        assetId: asset.id,
        osDropdownItemId: input.osDropdownItemId ?? null,
        osVersionDropdownItemId: input.osVersionDropdownItemId ?? null,
        domain: input.domain ?? null,
      })
      .returning();
    if (!computer) throw new Error("Failed to insert computer");

    await recordAuditLog({
      entityId: asset.entityId,
      actorUserId,
      action: "create",
      objectType: "asset",
      objectId: asset.id,
      after: { asset, computer },
    });

    return { asset, computer };
  });
}

export async function listComputers(
  entityId: string,
  options?: { includeSubtree?: boolean },
): Promise<Array<Asset & Computer>> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];

  const rows = await db
    .select()
    .from(assets)
    .innerJoin(computers, eq(computers.assetId, assets.id))
    .where(and(inArray(assets.entityId, entityIds), isNull(assets.deletedAt)))
    .orderBy(assets.name);

  return rows.map((r) => ({ ...r.assets, ...r.computers }));
}

export async function getComputerWithAsset(assetId: string): Promise<{ asset: Asset; computer: Computer } | undefined> {
  const [row] = await db.select().from(assets).innerJoin(computers, eq(computers.assetId, assets.id)).where(eq(assets.id, assetId));
  if (!row) return undefined;
  return { asset: row.assets, computer: row.computers };
}

export async function addAssetComponent(input: {
  assetId: string;
  componentType: AssetComponentType;
  name: string;
  quantity?: number;
  capacityValue?: number | null;
  capacityUnit?: string | null;
  serialNumber?: string | null;
}): Promise<AssetComponent> {
  const [created] = await db
    .insert(assetComponents)
    .values({
      assetId: input.assetId,
      componentType: input.componentType,
      name: input.name,
      quantity: input.quantity ?? 1,
      capacityValue: input.capacityValue ?? null,
      capacityUnit: input.capacityUnit ?? null,
      serialNumber: input.serialNumber ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert asset component");
  return created;
}

export async function listAssetComponents(assetId: string): Promise<AssetComponent[]> {
  return db.select().from(assetComponents).where(eq(assetComponents.assetId, assetId)).orderBy(assetComponents.componentType);
}

export async function removeAssetComponent(id: string): Promise<void> {
  await db.delete(assetComponents).where(eq(assetComponents.id, id));
}
