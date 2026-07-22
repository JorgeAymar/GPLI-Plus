import { and, eq, sql } from "drizzle-orm";
import { db, entities, profileModuleRights, profiles, userProfiles, type NewProfile, type Profile } from "@itsm/db";

export async function createProfile(input: {
  name: string;
  interface: "central" | "simplified";
  description?: string | null;
}): Promise<Profile> {
  let created: Profile | undefined;
  try {
    [created] = await db
      .insert(profiles)
      .values({
        name: input.name,
        interface: input.interface,
        description: input.description ?? null,
      } satisfies NewProfile)
      .returning();
  } catch (err) {
    // See user-service.ts's createUser for why this must be caught here:
    // Drizzle wraps the real node-postgres error (with raw query text) in
    // `.cause`; `23505` is Postgres's unique_violation SQLSTATE.
    const cause = err instanceof Error ? err.cause : undefined;
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505") {
      const constraint = "constraint" in cause ? cause.constraint : undefined;
      if (constraint === "profiles_name_unique") throw new Error("Ya existe un perfil con ese nombre.");
      throw new Error("Ya existe un perfil con esos datos.");
    }
    throw new Error("No se pudo crear el perfil.");
  }
  if (!created) throw new Error("No se pudo crear el perfil.");
  return created;
}

export async function listProfiles(): Promise<Profile[]> {
  return db.select().from(profiles).orderBy(profiles.name);
}

export async function getProfile(id: string): Promise<Profile | undefined> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
  return profile;
}

/** Every module's rights bitmask for a profile, keyed by moduleKey (modules with no row default to 0 in the caller). */
export async function listModuleRightsForProfile(profileId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ moduleKey: profileModuleRights.moduleKey, rights: profileModuleRights.rights })
    .from(profileModuleRights)
    .where(eq(profileModuleRights.profileId, profileId));
  return Object.fromEntries(rows.map((r) => [r.moduleKey, r.rights]));
}

export async function setModuleRight(profileId: string, moduleKey: string, rights: number): Promise<void> {
  await db
    .insert(profileModuleRights)
    .values({ profileId, moduleKey, rights })
    .onConflictDoUpdate({
      target: [profileModuleRights.profileId, profileModuleRights.moduleKey],
      set: { rights },
    });
}

export async function assignUserProfile(input: {
  userId: string;
  profileId: string;
  entityId: string;
  isRecursive?: boolean;
  isDefault?: boolean;
}) {
  const [created] = await db
    .insert(userProfiles)
    .values({
      userId: input.userId,
      profileId: input.profileId,
      entityId: input.entityId,
      isRecursive: input.isRecursive ?? true,
      isDefault: input.isDefault ?? false,
    })
    .returning();
  if (!created) throw new Error("Failed to insert user_profiles assignment");
  return created;
}

/**
 * Effective rights bitmask for a user on a module at a given entity, unioning
 * every assignment that either targets that exact entity, or is `isRecursive`
 * and targets an ancestor of it (checked via entities.path).
 */
export async function getEffectiveRights(userId: string, entityId: string, moduleKey: string): Promise<number> {
  const [targetEntity] = await db.select().from(entities).where(eq(entities.id, entityId));
  if (!targetEntity) return 0;

  const rows = await db
    .select({ rights: profileModuleRights.rights })
    .from(userProfiles)
    .innerJoin(profileModuleRights, eq(profileModuleRights.profileId, userProfiles.profileId))
    .innerJoin(entities, eq(entities.id, userProfiles.entityId))
    .where(
      and(
        eq(userProfiles.userId, userId),
        eq(profileModuleRights.moduleKey, moduleKey),
        sql`(${entities.id} = ${entityId} OR (${userProfiles.isRecursive} = true AND ${targetEntity.path}::ltree <@ ${entities.path}))`,
      ),
    );

  return rows.reduce((acc, r) => acc | r.rights, 0);
}

/** Every entity x profile assignment for a user - powers the entity/profile switchers. */
export async function listUserProfileAssignments(userId: string) {
  return db
    .select({
      id: userProfiles.id,
      entityId: entities.id,
      entityName: entities.name,
      profileId: profiles.id,
      profileName: profiles.name,
      interface: profiles.interface,
      isRecursive: userProfiles.isRecursive,
      isDefault: userProfiles.isDefault,
    })
    .from(userProfiles)
    .innerJoin(entities, eq(entities.id, userProfiles.entityId))
    .innerJoin(profiles, eq(profiles.id, userProfiles.profileId))
    .where(eq(userProfiles.userId, userId));
}
