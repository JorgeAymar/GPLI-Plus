"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  assignUserProfile,
  assignUserProfileSchema,
  createProfile,
  createProfileSchema,
  recordAuditLog,
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
  await recordAuditLog({
    entityId: context.activeEntity.id,
    actorUserId: context.user.id,
    action: "create",
    objectType: "profile",
    objectId: profile.id,
    after: profile,
  });
  revalidatePath("/administration/profiles");
  return profile;
}

export async function setModuleRightAction(profileId: string, moduleKey: string, rights: number) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_PROFILE, RIGHT.UPDATE);
  await setModuleRight(profileId, moduleKey, rights);
  await recordAuditLog({
    entityId: context.activeEntity.id,
    actorUserId: context.user.id,
    action: "update",
    objectType: "profile_module_right",
    objectId: profileId,
    after: { moduleKey, rights },
  });
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
  await recordAuditLog({
    entityId: parsed.entityId,
    actorUserId: context.user.id,
    action: "create",
    objectType: "user_profile_assignment",
    objectId: assignment.id,
    after: assignment,
  });
  revalidatePath("/administration/profiles");
  revalidatePath("/administration/users");
  return assignment;
}
