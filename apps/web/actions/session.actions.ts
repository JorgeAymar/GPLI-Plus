"use server";

import { unstable_update } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Entity and profile are switched together (not independently): a profile
 * assignment is always scoped to one entity, so the UI only ever offers
 * valid (entity, profile) pairs the user actually holds - see
 * listUserProfileAssignments().
 */
export async function switchContext(input: { entityId: string; profileId: string }): Promise<void> {
  await unstable_update({ activeEntityId: input.entityId, activeProfileId: input.profileId });
  revalidatePath("/");
}
