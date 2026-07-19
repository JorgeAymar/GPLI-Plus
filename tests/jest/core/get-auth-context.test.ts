/**
 * Jest coverage for packages/core/src/auth/get-auth-context.ts - previously the highest
 * blast-radius file in the codebase with zero direct test coverage (see
 * docs/superpowers/specs/2026-07-19-plan-de-pruebas.md §4.2). Runs against the same real dev
 * Postgres the Vitest suite uses; no mocks anywhere in this file.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, users, type Entity, type Profile, type User } from "@itsm/db";
import { assignUserProfile, resolveAuthContext, type RawSession } from "@itsm/core";
import {
  createTestEntity,
  createTestProfile,
  createTestUser,
  deleteTestEntitiesByPrefix,
  deleteTestProfilesByPrefix,
  deleteTestUsersByPrefix,
} from "../support/fixtures";

describe("resolveAuthContext", () => {
  let entityA: Entity;
  let entityB: Entity;
  let profileA: Profile;
  let profileB: Profile;
  let user: User;

  beforeAll(async () => {
    entityA = await createTestEntity();
    entityB = await createTestEntity();
    profileA = await createTestProfile();
    profileB = await createTestProfile();
    user = await createTestUser();

    // The user's only real assignment: entityA + profileA, marked as default, non-recursive
    // so the isRecursive-propagation assertions below are unambiguous.
    await assignUserProfile({
      userId: user.id,
      profileId: profileA.id,
      entityId: entityA.id,
      isRecursive: false,
      isDefault: true,
    });
  });

  afterAll(async () => {
    await deleteTestUsersByPrefix();
    await deleteTestProfilesByPrefix();
    await deleteTestEntitiesByPrefix();
  });

  it("returns null for a null session", async () => {
    await expect(resolveAuthContext(null)).resolves.toBeNull();
  });

  it("returns null when the session's userId doesn't match any user row", async () => {
    const session: RawSession = { userId: randomUUID(), activeEntityId: null, activeProfileId: null };
    await expect(resolveAuthContext(session)).resolves.toBeNull();
  });

  it("returns null when the user exists but is deactivated", async () => {
    const inactiveUser = await createTestUser();
    await db.update(users).set({ isActive: false }).where(eq(users.id, inactiveUser.id));
    await assignUserProfile({ userId: inactiveUser.id, profileId: profileA.id, entityId: entityA.id, isDefault: true });

    const session: RawSession = { userId: inactiveUser.id, activeEntityId: null, activeProfileId: null };
    await expect(resolveAuthContext(session)).resolves.toBeNull();
  });

  describe("first login (no activeEntityId/activeProfileId on the session yet)", () => {
    it("falls back to the user's default user_profiles assignment", async () => {
      const session: RawSession = { userId: user.id, activeEntityId: null, activeProfileId: null };
      const context = await resolveAuthContext(session);

      expect(context).not.toBeNull();
      expect(context?.user.id).toBe(user.id);
      expect(context?.activeEntity.id).toBe(entityA.id);
      expect(context?.activeProfile.id).toBe(profileA.id);
      expect(context?.isRecursive).toBe(false);
    });

    it("returns null when the user has no default assignment at all", async () => {
      const orphanUser = await createTestUser();
      const session: RawSession = { userId: orphanUser.id, activeEntityId: null, activeProfileId: null };
      await expect(resolveAuthContext(session)).resolves.toBeNull();
    });
  });

  describe("explicit (activeEntityId, activeProfileId) on the session", () => {
    it("resolves a second real assignment for the same user, distinct from their default one", async () => {
      await assignUserProfile({
        userId: user.id,
        profileId: profileB.id,
        entityId: entityB.id,
        isRecursive: true,
        isDefault: false,
      });

      const session: RawSession = { userId: user.id, activeEntityId: entityB.id, activeProfileId: profileB.id };
      const context = await resolveAuthContext(session);

      expect(context?.activeEntity.id).toBe(entityB.id);
      expect(context?.activeProfile.id).toBe(profileB.id);
      // Distinct from the default assignment's isRecursive=false - proves the right
      // assignment row was matched, not just the user's default one.
      expect(context?.isRecursive).toBe(true);
    });

    it("returns null when activeEntityId points at an entity that doesn't exist", async () => {
      const session: RawSession = { userId: user.id, activeEntityId: randomUUID(), activeProfileId: profileA.id };
      await expect(resolveAuthContext(session)).resolves.toBeNull();
    });

    it("returns null when activeProfileId points at a profile that doesn't exist", async () => {
      const session: RawSession = { userId: user.id, activeEntityId: entityA.id, activeProfileId: randomUUID() };
      await expect(resolveAuthContext(session)).resolves.toBeNull();
    });

    // Regression test for a real bug found while writing this suite: resolveAuthContext used
    // to trust ANY (activeEntityId, activeProfileId) pair on the session as long as both rows
    // existed *somewhere* in the system, without checking the user actually holds a
    // user_profiles assignment for that specific pair. Concretely, this let a forged/stale
    // session (e.g. apps/web/actions/session.actions.ts's switchContext(), which writes
    // client-supplied entityId/profileId straight into the JWT with no server-side check)
    // resolve into a "valid" AuthContext for an entity+profile the user was never assigned -
    // silently defaulting isRecursive to true. Fixed in get-auth-context.ts to require a real
    // matching user_profiles row before returning a context, the same way every other invalid
    // state in this function already returns null instead of a best-effort guess.
    it("returns null when entity and profile both exist but the user has no real assignment for that pair (privilege-escalation guard)", async () => {
      const unassignedEntity = await createTestEntity();
      const unassignedProfile = await createTestProfile();

      const session: RawSession = {
        userId: user.id,
        activeEntityId: unassignedEntity.id,
        activeProfileId: unassignedProfile.id,
      };
      await expect(resolveAuthContext(session)).resolves.toBeNull();
    });

    it("returns null for a mismatched partial session (a real entityId paired with a profileId borrowed from an unrelated default assignment)", async () => {
      // entityB is real and entityB+profileB is itself a real assignment for this user, but
      // pairing entityB with profileA (the *other* assignment's profile) does not correspond
      // to any user_profiles row - must not be silently accepted either.
      const session: RawSession = { userId: user.id, activeEntityId: entityB.id, activeProfileId: profileA.id };
      await expect(resolveAuthContext(session)).resolves.toBeNull();
    });
  });
});
