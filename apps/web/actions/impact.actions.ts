"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, addImpactRelation, addImpactRelationSchema, removeImpactRelation, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

// addImpactRelationSchema has no single "owner" id to revalidate from (a
// relation always has two asset ids, and either one's impact page could be
// the one currently open) - like addProjectTaskLinkAction in
// projects.actions.ts, the caller passes viewAssetId separately purely for
// the revalidatePath call.
export async function addImpactRelationAction(input: unknown, viewAssetId: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_IMPACT, RIGHT.CREATE);
  const parsed = addImpactRelationSchema.parse(input);
  const relation = await addImpactRelation(parsed);
  revalidatePath(`/assets/impact/${viewAssetId}`);
  return relation;
}

export async function removeImpactRelationAction(id: string, viewAssetId: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_IMPACT, RIGHT.DELETE);
  await removeImpactRelation(id);
  revalidatePath(`/assets/impact/${viewAssetId}`);
}
