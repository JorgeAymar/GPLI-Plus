import { and, eq } from "drizzle-orm";
import { db, entities, profiles, userProfiles, users, type Entity, type Profile, type User } from "@itsm/db";

export interface AuthContext {
  user: User;
  activeEntity: Entity;
  activeProfile: Profile;
  isRecursive: boolean;
}

/** Auth.js only gives us the raw session row - this is the shape apps/web passes in. */
export interface RawSession {
  userId: string;
  activeEntityId: string | null;
  activeProfileId: string | null;
}

/**
 * Resolves the full domain auth context (user + active entity + active profile)
 * from a raw session. Falls back to the user's default `user_profiles` row on
 * first login (before the entity/profile switcher has ever been used).
 *
 * Framework-agnostic on purpose: apps/web wraps this with `auth()` + React
 * `cache()`, so @itsm/core never depends on Next.js/Auth.js.
 */
export async function resolveAuthContext(session: RawSession | null): Promise<AuthContext | null> {
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user || !user.isActive) return null;

  let entityId = session.activeEntityId;
  let profileId = session.activeProfileId;

  if (!entityId || !profileId) {
    const [defaultAssignment] = await db
      .select()
      .from(userProfiles)
      .where(and(eq(userProfiles.userId, user.id), eq(userProfiles.isDefault, true)));
    if (!defaultAssignment) return null;
    entityId = entityId ?? defaultAssignment.entityId;
    profileId = profileId ?? defaultAssignment.profileId;
  }

  const [activeEntity] = await db.select().from(entities).where(eq(entities.id, entityId));
  const [activeProfile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!activeEntity || !activeProfile) return null;

  // A real `user_profiles` row for this exact (user, entity, profile) triple must exist -
  // this is not just how `isRecursive` gets its value below, it is the actual authorization
  // check for "is this user really allowed to be active in this entity+profile". Without it,
  // a forged or stale session (entityId/profileId that both happen to reference real rows,
  // but were never actually assigned to this user - e.g. apps/web/actions/session.actions.ts's
  // switchContext() writes client-supplied ids straight into the JWT with no server-side
  // check of its own) would resolve into a "valid" AuthContext here, silently defaulting
  // isRecursive to true. Every other invalid state in this function already returns null
  // instead of guessing; this must too.
  const [assignment] = await db
    .select()
    .from(userProfiles)
    .where(and(eq(userProfiles.userId, user.id), eq(userProfiles.entityId, entityId), eq(userProfiles.profileId, profileId)));
  if (!assignment) return null;

  return {
    user,
    activeEntity,
    activeProfile,
    isRecursive: assignment.isRecursive,
  };
}
