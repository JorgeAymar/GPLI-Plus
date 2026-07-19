/**
 * Shared DB fixtures for the Jest test surface (tests/jest/**). Deliberately
 * separate from packages/core/src/__vitest_tools__/fixtures.ts (that file is
 * Vitest-only infrastructure, per its own doc comment) - this is the Jest
 * equivalent, same idea: every row created here is tagged with the
 * `__jest_tools__` prefix so leftover rows are easy to spot if a run gets
 * interrupted before its afterAll/afterEach cleanup runs, and callers are
 * responsible for deleting in FK-safe order in their own afterAll.
 */
import { randomUUID } from "node:crypto";
import { desc, eq, like } from "drizzle-orm";
import {
  db,
  entities,
  profiles,
  users,
  type Entity,
  type Profile,
  type User,
} from "@itsm/db";
import { createEntity } from "../../../packages/core/src/entities/entity-service";
import { createProfile } from "../../../packages/core/src/rbac/profile-service";
import { createUser } from "../../../packages/core/src/users/user-service";

export const PREFIX = "__jest_tools__";

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export async function createTestEntity(overrides?: { name?: string; parentId?: string | null }): Promise<Entity> {
  return createEntity({
    name: overrides?.name ?? `${PREFIX}_entity_${uniqueSuffix()}`,
    parentId: overrides?.parentId ?? null,
  });
}

export async function createTestUser(overrides?: Partial<{ email: string; username: string; displayName: string }>): Promise<User> {
  const suffix = uniqueSuffix();
  return createUser({
    email: overrides?.email ?? `${PREFIX}-${suffix}@example.test`,
    username: overrides?.username ?? `${PREFIX}_${suffix}`,
    password: "supersecret-not-used",
    displayName: overrides?.displayName ?? `${PREFIX} user ${suffix}`,
  });
}

export async function createTestProfile(overrides?: Partial<{ name: string; interface: "central" | "simplified" }>): Promise<Profile> {
  const suffix = uniqueSuffix();
  return createProfile({
    name: overrides?.name ?? `${PREFIX}_profile_${suffix}`,
    interface: overrides?.interface ?? "central",
  });
}

export async function deleteTestUsersByPrefix(): Promise<void> {
  await db.delete(users).where(like(users.email, `${PREFIX}%`));
}

export async function deleteTestProfilesByPrefix(): Promise<void> {
  await db.delete(profiles).where(like(profiles.name, `${PREFIX}%`));
}

/** Deletes every entity tagged with our prefix, deepest level first so self-referencing parent_id FKs never block deletion. */
export async function deleteTestEntitiesByPrefix(): Promise<void> {
  const rows = await db
    .select({ id: entities.id })
    .from(entities)
    .where(like(entities.name, `${PREFIX}%`))
    .orderBy(desc(entities.level));
  for (const row of rows) {
    await db.delete(entities).where(eq(entities.id, row.id));
  }
}
