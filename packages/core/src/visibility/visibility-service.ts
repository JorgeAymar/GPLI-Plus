import { and, eq } from "drizzle-orm";
import { db, resourceVisibilityRules, userGroups, type ResourceVisibilityRule, type VisibilityGranteeKind } from "@itsm/db";
import type { AuthContext } from "../auth/get-auth-context";
import { listAncestors } from "../entities/entity-service";

export async function addVisibilityRule(input: {
  resourceType: string;
  resourceId: string;
  granteeKind: VisibilityGranteeKind;
  granteeId: string;
  isRecursive?: boolean;
}): Promise<ResourceVisibilityRule> {
  const [created] = await db
    .insert(resourceVisibilityRules)
    .values({
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      granteeKind: input.granteeKind,
      granteeId: input.granteeId,
      isRecursive: input.isRecursive ?? false,
    })
    .returning();
  if (!created) throw new Error("Failed to insert resource visibility rule");
  return created;
}

export async function listVisibilityRules(resourceType: string, resourceId: string): Promise<ResourceVisibilityRule[]> {
  return db
    .select()
    .from(resourceVisibilityRules)
    .where(and(eq(resourceVisibilityRules.resourceType, resourceType), eq(resourceVisibilityRules.resourceId, resourceId)));
}

export async function removeVisibilityRule(id: string): Promise<void> {
  await db.delete(resourceVisibilityRules).where(eq(resourceVisibilityRules.id, id));
}

/**
 * True if the owner, or any visibility rule for this resource, grants access to
 * the given context: direct user match, one of the user's groups, the user's
 * active profile, or the user's active entity (walking up ancestors when a
 * matching entity rule has isRecursive=true).
 */
export async function isResourceVisibleTo(
  resourceType: string,
  resourceId: string,
  ownerUserId: string | null,
  context: AuthContext,
): Promise<boolean> {
  if (ownerUserId === context.user.id) return true;

  const rules = await listVisibilityRules(resourceType, resourceId);
  if (rules.length === 0) return false;

  const userRule = rules.find((r) => r.granteeKind === "user" && r.granteeId === context.user.id);
  if (userRule) return true;

  const profileRule = rules.find((r) => r.granteeKind === "profile" && r.granteeId === context.activeProfile.id);
  if (profileRule) return true;

  const groupRules = rules.filter((r) => r.granteeKind === "group");
  if (groupRules.length > 0) {
    const memberships = await db.select().from(userGroups).where(eq(userGroups.userId, context.user.id));
    const memberGroupIds = new Set(memberships.map((m) => m.groupId));
    if (groupRules.some((r) => memberGroupIds.has(r.granteeId))) return true;
  }

  const entityRules = rules.filter((r) => r.granteeKind === "entity");
  if (entityRules.length > 0) {
    const ancestorIds = new Set((await listAncestors(context.activeEntity.id)).map((e) => e.id));
    for (const rule of entityRules) {
      if (rule.isRecursive && ancestorIds.has(rule.granteeId)) return true;
      if (!rule.isRecursive && rule.granteeId === context.activeEntity.id) return true;
    }
  }

  return false;
}
