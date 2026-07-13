/**
 * Shared integration-test fixtures for @itsm/core. NOT a test file itself
 * (no `.test.ts` in the name, so vitest's default include glob skips it).
 *
 * Every row created through these helpers is tagged with the
 * `__vitest_tools__` prefix (in whatever unique/human-readable column each
 * table exposes - name/email/username/key) so leftover rows are easy to spot
 * and hand-clean if a test run is interrupted before its `afterAll` runs.
 *
 * Callers are responsible for deleting rows in FK-safe order in their own
 * `afterAll` - the `deleteTest*` helpers here just wrap the common tables in
 * one place instead of repeating `db.delete(...).where(inArray(...))` everywhere.
 */
import { inArray } from "drizzle-orm";
import {
  db,
  entities,
  groups,
  profiles,
  userGroups,
  users,
  type Entity,
  type Group,
  type Profile,
  type User,
} from "@itsm/db";
import type { AuthContext } from "../auth/get-auth-context";
import { createEntity } from "../entities/entity-service";

export const PREFIX = "__vitest_tools__";

/** Short random tag so parallel test files never collide on unique columns (email/username/key/name). */
export function uniqueSuffix(): string {
  return crypto.randomUUID().slice(0, 8);
}

export async function createTestEntity(overrides?: { name?: string; parentId?: string | null }): Promise<Entity> {
  return createEntity({
    name: overrides?.name ?? `${PREFIX} entity ${uniqueSuffix()}`,
    parentId: overrides?.parentId ?? null,
  });
}

export async function createTestUser(
  overrides?: Partial<{ email: string; username: string; displayName: string }>,
): Promise<User> {
  const suffix = uniqueSuffix();
  const [created] = await db
    .insert(users)
    .values({
      email: overrides?.email ?? `${PREFIX}-${suffix}@example.test`,
      username: overrides?.username ?? `${PREFIX}_${suffix}`,
      displayName: overrides?.displayName ?? `${PREFIX} user ${suffix}`,
    })
    .returning();
  if (!created) throw new Error("Failed to insert test user");
  return created;
}

export async function createTestProfile(overrides?: Partial<{ name: string }>): Promise<Profile> {
  const suffix = uniqueSuffix();
  const [created] = await db
    .insert(profiles)
    .values({
      name: overrides?.name ?? `${PREFIX} profile ${suffix}`,
    })
    .returning();
  if (!created) throw new Error("Failed to insert test profile");
  return created;
}

export async function createTestGroup(entityId: string, overrides?: Partial<{ name: string }>): Promise<Group> {
  const suffix = uniqueSuffix();
  const [created] = await db
    .insert(groups)
    .values({
      entityId,
      name: overrides?.name ?? `${PREFIX} group ${suffix}`,
    })
    .returning();
  if (!created) throw new Error("Failed to insert test group");
  return created;
}

export async function addUserToGroup(userId: string, groupId: string): Promise<void> {
  await db.insert(userGroups).values({ userId, groupId });
}

export function buildAuthContext(user: User, activeEntity: Entity, activeProfile: Profile, isRecursive = true): AuthContext {
  return { user, activeEntity, activeProfile, isRecursive };
}

export async function deleteTestUsers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(users).where(inArray(users.id, ids));
}

export async function deleteTestProfiles(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(profiles).where(inArray(profiles.id, ids));
}

export async function deleteTestGroups(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(groups).where(inArray(groups.id, ids));
}

/** Deletes a whole set of entity ids (root + descendants) in one statement - safe because Postgres
 * checks a plain (NO ACTION) self-referencing FK at end-of-statement, not row-by-row, so the parent
 * and its children can be removed together regardless of array order. */
export async function deleteTestEntities(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(entities).where(inArray(entities.id, ids));
}
