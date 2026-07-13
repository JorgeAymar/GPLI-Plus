"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, acceptSubmissionAsUnmanaged, lockField, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function lockInventoryFieldAction(assetId: string, fieldName: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_INVENTORY, RIGHT.UPDATE);

  const trimmed = fieldName.trim();
  if (!trimmed) throw new Error("El nombre del campo es obligatorio");

  const locked = await lockField(assetId, trimmed);
  revalidatePath("/setup/inventory-agents");
  return locked;
}

export async function acceptUnmanagedAction(submissionId: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSETS_UNMANAGED, RIGHT.CREATE);

  const result = await acceptSubmissionAsUnmanaged(submissionId, context.activeEntity.id, context.user.id);
  revalidatePath("/setup/inventory-agents");
  return result;
}
