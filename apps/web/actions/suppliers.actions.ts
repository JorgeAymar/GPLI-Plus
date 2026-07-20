"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createSupplier, createSupplierSchema, getSupplier, recordAuditLog, requireRight, softDeleteSupplier } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createSupplierAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_SUPPLIER, RIGHT.CREATE);
  const parsed = createSupplierSchema.parse(input);
  const supplier = await createSupplier(parsed);
  await recordAuditLog({
    entityId: supplier.entityId,
    actorUserId: context.user.id,
    action: "create",
    objectType: "supplier",
    objectId: supplier.id,
    after: supplier,
  });
  revalidatePath("/management/suppliers");
  return supplier;
}

export async function softDeleteSupplierAction(id: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_SUPPLIER, RIGHT.DELETE);
  const before = await getSupplier(id);
  const supplier = await softDeleteSupplier(id);
  await recordAuditLog({
    entityId: supplier.entityId,
    actorUserId: context.user.id,
    action: "delete",
    objectType: "supplier",
    objectId: supplier.id,
    before,
  });
  revalidatePath("/management/suppliers");
  return supplier;
}
