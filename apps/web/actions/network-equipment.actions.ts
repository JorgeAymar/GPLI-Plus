"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createNetworkEquipment, createNetworkEquipmentSchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createNetworkEquipmentAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSETS_NETWORK_EQUIPMENT, RIGHT.CREATE);
  const parsed = createNetworkEquipmentSchema.parse(input);
  const result = await createNetworkEquipment(parsed, context.user.id);
  revalidatePath("/assets/network-equipment");
  return result;
}
