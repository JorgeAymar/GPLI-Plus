import {
  assets,
  contractAssets,
  contracts,
  db,
  type Asset,
  type BillingFrequency,
  type Contract,
  type ContractType,
} from "@itsm/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

export async function createContract(input: {
  entityId: string;
  supplierId?: string | null;
  name: string;
  contractType?: ContractType;
  billingFrequency?: BillingFrequency;
  costCents?: number | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  renewalNoticeDays?: number | null;
  comment?: string | null;
}): Promise<Contract> {
  const [created] = await db
    .insert(contracts)
    .values({
      entityId: input.entityId,
      supplierId: input.supplierId ?? null,
      name: input.name,
      contractType: input.contractType ?? "other",
      billingFrequency: input.billingFrequency ?? "annual",
      costCents: input.costCents ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      renewalNoticeDays: input.renewalNoticeDays ?? null,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert contract");
  return created;
}

export async function getContract(id: string): Promise<Contract | undefined> {
  const [row] = await db.select().from(contracts).where(eq(contracts.id, id));
  return row;
}

export async function listContracts(entityId: string, options?: { includeSubtree?: boolean }): Promise<Contract[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(contracts)
    .where(and(inArray(contracts.entityId, entityIds), isNull(contracts.deletedAt)))
    .orderBy(contracts.name);
}

export async function linkContractAsset(contractId: string, assetId: string): Promise<void> {
  await db.insert(contractAssets).values({ contractId, assetId }).onConflictDoNothing();
}

export async function unlinkContractAsset(contractId: string, assetId: string): Promise<void> {
  await db.delete(contractAssets).where(and(eq(contractAssets.contractId, contractId), eq(contractAssets.assetId, assetId)));
}

export async function listAssetsForContract(contractId: string): Promise<Asset[]> {
  const rows = await db
    .select({ asset: assets })
    .from(contractAssets)
    .innerJoin(assets, eq(assets.id, contractAssets.assetId))
    .where(eq(contractAssets.contractId, contractId));
  return rows.map((r) => r.asset);
}
