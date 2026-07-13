"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createContract,
  createContractSchema,
  linkContractAsset,
  linkContractAssetSchema,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createContractAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONTRACT, RIGHT.CREATE);
  const parsed = createContractSchema.parse(input);
  const contract = await createContract(parsed);
  revalidatePath("/management/contracts");
  return contract;
}

export async function linkContractAssetAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONTRACT, RIGHT.UPDATE);
  const parsed = linkContractAssetSchema.parse(input);
  await linkContractAsset(parsed.contractId, parsed.assetId);
  revalidatePath(`/management/contracts/${parsed.contractId}`);
}
