"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createContract,
  createContractSchema,
  getContract,
  linkContractAsset,
  linkContractAssetSchema,
  recordAuditLog,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createContractAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONTRACT, RIGHT.CREATE);
  const parsed = createContractSchema.parse(input);
  const contract = await createContract(parsed);
  await recordAuditLog({
    entityId: contract.entityId,
    actorUserId: context.user.id,
    action: "create",
    objectType: "contract",
    objectId: contract.id,
    after: contract,
  });
  revalidatePath("/management/contracts");
  return contract;
}

export async function linkContractAssetAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONTRACT, RIGHT.UPDATE);
  const parsed = linkContractAssetSchema.parse(input);
  await linkContractAsset(parsed.contractId, parsed.assetId);
  // Same fallback as addUserToGroupAction in groups.actions.ts: the join row has no entity of
  // its own, so scope the audit entry to the contract's entity (falling back to the caller's
  // active entity if the contract has somehow already vanished).
  const contract = await getContract(parsed.contractId);
  await recordAuditLog({
    entityId: contract?.entityId ?? context.activeEntity.id,
    actorUserId: context.user.id,
    action: "create",
    objectType: "contract_asset",
    objectId: parsed.contractId,
    after: { contractId: parsed.contractId, assetId: parsed.assetId },
  });
  revalidatePath(`/management/contracts/${parsed.contractId}`);
}
