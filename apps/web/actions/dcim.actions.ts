"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  addClusterMember,
  addClusterMemberSchema,
  createCable,
  createCableSchema,
  placeInRack,
  placeInRackSchema,
  removeFromRack,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function placeInRackAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_DCIM, RIGHT.CREATE);
  const parsed = placeInRackSchema.parse(input);
  const slot = await placeInRack(parsed);
  revalidatePath(`/assets/dcim/racks/${parsed.rackAssetId}`);
  return slot;
}

export async function removeFromRackAction(id: string, rackAssetId: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_DCIM, RIGHT.DELETE);
  await removeFromRack(id);
  revalidatePath(`/assets/dcim/racks/${rackAssetId}`);
}

export async function addClusterMemberAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_DCIM, RIGHT.CREATE);
  const parsed = addClusterMemberSchema.parse(input);
  const member = await addClusterMember(parsed.clusterAssetId, parsed.memberAssetId);
  revalidatePath("/assets/dcim");
  return member;
}

export async function createCableAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_DCIM, RIGHT.CREATE);
  const parsed = createCableSchema.parse(input);
  const cable = await createCable(parsed);
  revalidatePath("/assets/dcim/cables");
  return cable;
}
