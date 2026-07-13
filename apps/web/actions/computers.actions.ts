"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  addAssetComponent,
  addAssetComponentSchema,
  createComputer,
  createComputerSchema,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createComputerAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSETS_COMPUTER, RIGHT.CREATE);
  const parsed = createComputerSchema.parse(input);
  const result = await createComputer(parsed, context.user.id);
  revalidatePath("/assets/computers");
  return result;
}

export async function addAssetComponentAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSETS_COMPUTER, RIGHT.UPDATE);
  const parsed = addAssetComponentSchema.parse(input);
  const component = await addAssetComponent(parsed);
  revalidatePath(`/assets/computers/${parsed.assetId}`);
  return component;
}
