"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createSupplier, createSupplierSchema, requireRight, softDeleteSupplier } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createSupplierAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_SUPPLIER, RIGHT.CREATE);
  const parsed = createSupplierSchema.parse(input);
  const supplier = await createSupplier(parsed);
  revalidatePath("/management/suppliers");
  return supplier;
}

export async function softDeleteSupplierAction(id: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_SUPPLIER, RIGHT.DELETE);
  const supplier = await softDeleteSupplier(id);
  revalidatePath("/management/suppliers");
  return supplier;
}
