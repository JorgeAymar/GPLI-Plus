"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  assignUserProfile,
  assignUserProfileSchema,
  createProfile,
  createProfileSchema,
  requireRight,
  setModuleRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createProfileAction(input: {
  name: string;
  interface: "central" | "simplified";
  description?: string | null;
  isDefault?: boolean;
}) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_PROFILE, RIGHT.CREATE);
  const parsed = createProfileSchema.parse(input);
  const profile = await createProfile(parsed);
  revalidatePath("/administration/profiles");
  return profile;
}

export async function setModuleRightAction(profileId: string, moduleKey: string, rights: number) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_PROFILE, RIGHT.UPDATE);
  await setModuleRight(profileId, moduleKey, rights);
  revalidatePath("/administration/profiles");
  revalidatePath(`/administration/profiles/${profileId}`);
}

export async function assignUserProfileAction(input: {
  userId: string;
  profileId: string;
  entityId: string;
  isRecursive?: boolean;
  isDefault?: boolean;
}) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_PROFILE, RIGHT.ASSIGN);
  const parsed = assignUserProfileSchema.parse(input);
  const assignment = await assignUserProfile(parsed);
  revalidatePath("/administration/profiles");
  revalidatePath("/administration/users");
  return assignment;
}
