import { db, groups, userGroups, users, type Group } from "@itsm/db";
import { and, eq, inArray } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

export async function createGroup(input: { parentId?: string | null; entityId: string; name: string }): Promise<Group> {
  const [created] = await db
    .insert(groups)
    .values({
      parentId: input.parentId ?? null,
      entityId: input.entityId,
      name: input.name,
    })
    .returning();
  if (!created) throw new Error("Failed to insert group");
  return created;
}

export async function getGroup(id: string): Promise<Group | undefined> {
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  return group;
}

export async function updateGroup(id: string, input: Partial<{ name: string; parentId: string | null; isActive: boolean }>): Promise<Group> {
  const [updated] = await db
    .update(groups)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(groups.id, id))
    .returning();
  if (!updated) throw new Error(`Group ${id} not found`);
  return updated;
}

export async function listGroups(entityId: string, options?: { includeSubtree?: boolean }): Promise<Group[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(groups)
    .where(and(inArray(groups.entityId, entityIds), eq(groups.isActive, true)))
    .orderBy(groups.name);
}

export async function addUserToGroup(userId: string, groupId: string, isManager?: boolean): Promise<void> {
  await db
    .insert(userGroups)
    .values({ userId, groupId, isManager: isManager ?? false })
    .onConflictDoUpdate({ target: [userGroups.userId, userGroups.groupId], set: { isManager: isManager ?? false } });
}

export async function removeUserFromGroup(userId: string, groupId: string): Promise<void> {
  await db.delete(userGroups).where(and(eq(userGroups.userId, userId), eq(userGroups.groupId, groupId)));
}

export async function listGroupMembers(groupId: string): Promise<Array<{ userId: string; displayName: string; isManager: boolean }>> {
  const rows = await db
    .select({ userId: users.id, displayName: users.displayName, isManager: userGroups.isManager })
    .from(userGroups)
    .innerJoin(users, eq(users.id, userGroups.userId))
    .where(eq(userGroups.groupId, groupId))
    .orderBy(users.displayName);
  return rows;
}

export async function listGroupsForUser(userId: string): Promise<Group[]> {
  const rows = await db
    .select({ group: groups })
    .from(userGroups)
    .innerJoin(groups, eq(groups.id, userGroups.groupId))
    .where(eq(userGroups.userId, userId));
  return rows.map((r) => r.group);
}
