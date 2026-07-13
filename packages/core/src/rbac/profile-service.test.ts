import "dotenv/config";
import { db, entities, profileModuleRights, profiles, users, type Entity, type Profile, type User } from "@itsm/db";
import { and, desc, eq, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RIGHT } from "../auth/permissions";
import { createEntity } from "../entities/entity-service";
import { createUser } from "../users/user-service";
import {
  assignUserProfile,
  createProfile,
  getEffectiveRights,
  getProfile,
  listModuleRightsForProfile,
  listProfiles,
  listUserProfileAssignments,
  setModuleRight,
} from "./profile-service";

const PREFIX = "__vitest_rbac__profile_svc_";
const RUN_ID = randomUUID().slice(0, 8);
const MODULE_A = `${PREFIX}module_a`;
const MODULE_B = `${PREFIX}module_b`;
const MODULE_C = `${PREFIX}module_c`;

describe("profile-service", () => {
  let root: Entity;
  let child: Entity;
  let user: User;

  beforeAll(async () => {
    root = await createEntity({ name: `${PREFIX}root` });
    child = await createEntity({ name: `${PREFIX}child`, parentId: root.id });
    user = await createUser({
      email: `${PREFIX}${RUN_ID}@example.test`,
      username: `${PREFIX}${RUN_ID}`,
      password: "supersecret",
      displayName: "Vitest Profile User",
    });
  });

  afterAll(async () => {
    // Deleting the user cascades user_profiles; deleting profiles cascades profile_module_rights
    // and any remaining user_profiles rows. Entities go last (level desc, self-referencing parent_id).
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
    await db.delete(profiles).where(like(profiles.name, `${PREFIX}%`));
    const entityRows = await db
      .select({ id: entities.id })
      .from(entities)
      .where(like(entities.name, `${PREFIX}%`))
      .orderBy(desc(entities.level));
    for (const row of entityRows) {
      await db.delete(entities).where(eq(entities.id, row.id));
    }
  });

  describe("createProfile / getProfile / listProfiles", () => {
    let profile: Profile;

    it("creates a profile defaulting isDefault to false", async () => {
      profile = await createProfile({ name: `${PREFIX}${RUN_ID}_p1`, interface: "central" });
      expect(profile.isDefault).toBe(false);
      expect(profile.interface).toBe("central");
    });

    it("fetches the profile by id", async () => {
      const found = await getProfile(profile.id);
      expect(found?.id).toBe(profile.id);
    });

    it("returns undefined for an unknown profile id", async () => {
      const found = await getProfile("00000000-0000-0000-0000-000000000000");
      expect(found).toBeUndefined();
    });

    it("lists the created profile among all profiles", async () => {
      const all = await listProfiles();
      expect(all.map((p) => p.id)).toContain(profile.id);
    });
  });

  describe("setModuleRight / listModuleRightsForProfile", () => {
    it("stores a module's rights bitmask for a profile", async () => {
      const profile = await createProfile({ name: `${PREFIX}${RUN_ID}_p2`, interface: "central" });
      await setModuleRight(profile.id, MODULE_A, RIGHT.CREATE | RIGHT.READ);
      await setModuleRight(profile.id, MODULE_B, RIGHT.DELETE);

      const rights = await listModuleRightsForProfile(profile.id);
      expect(rights[MODULE_A]).toBe(RIGHT.CREATE | RIGHT.READ);
      expect(rights[MODULE_B]).toBe(RIGHT.DELETE);
    });

    it("upserts on conflict instead of duplicating the (profileId, moduleKey) row", async () => {
      const profile = await createProfile({ name: `${PREFIX}${RUN_ID}_p3`, interface: "central" });
      await setModuleRight(profile.id, MODULE_A, RIGHT.READ);
      await setModuleRight(profile.id, MODULE_A, RIGHT.READ | RIGHT.UPDATE);

      const rows = await db
        .select()
        .from(profileModuleRights)
        .where(and(eq(profileModuleRights.profileId, profile.id), eq(profileModuleRights.moduleKey, MODULE_A)));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.rights).toBe(RIGHT.READ | RIGHT.UPDATE);
    });
  });

  describe("assignUserProfile / listUserProfileAssignments", () => {
    it("creates an assignment and surfaces it via listUserProfileAssignments", async () => {
      const profile = await createProfile({ name: `${PREFIX}${RUN_ID}_p4`, interface: "simplified" });
      const created = await assignUserProfile({ userId: user.id, profileId: profile.id, entityId: root.id, isRecursive: false });
      expect(created.userId).toBe(user.id);
      expect(created.entityId).toBe(root.id);
      expect(created.isRecursive).toBe(false);

      const assignments = await listUserProfileAssignments(user.id);
      const match = assignments.find((a) => a.id === created.id);
      expect(match).toMatchObject({
        entityId: root.id,
        profileId: profile.id,
        profileName: profile.name,
        interface: "simplified",
        isRecursive: false,
      });
    });
  });

  describe("getEffectiveRights", () => {
    it("returns 0 when the user has no assignment at all", async () => {
      const rights = await getEffectiveRights(user.id, root.id, `${PREFIX}nothing_assigned`);
      expect(rights).toBe(0);
    });

    it("returns 0 for an unknown entity id", async () => {
      const rights = await getEffectiveRights(user.id, "00000000-0000-0000-0000-000000000000", MODULE_A);
      expect(rights).toBe(0);
    });

    it("returns the exact-entity rights for a direct (non-recursive) assignment", async () => {
      const profile = await createProfile({ name: `${PREFIX}${RUN_ID}_exact`, interface: "central" });
      await setModuleRight(profile.id, MODULE_A, RIGHT.CREATE | RIGHT.READ);
      await assignUserProfile({ userId: user.id, profileId: profile.id, entityId: root.id, isRecursive: false });

      const rights = await getEffectiveRights(user.id, root.id, MODULE_A);
      expect(rights).toBe(RIGHT.CREATE | RIGHT.READ);
      // CREATE+READ does not imply UPDATE - the bitmask must be exact.
      expect(rights & RIGHT.UPDATE).toBe(0);
    });

    it("does NOT propagate a non-recursive assignment down to a descendant entity", async () => {
      const profile = await createProfile({ name: `${PREFIX}${RUN_ID}_nonrec`, interface: "central" });
      await setModuleRight(profile.id, MODULE_B, RIGHT.DELETE);
      await assignUserProfile({ userId: user.id, profileId: profile.id, entityId: root.id, isRecursive: false });

      const atRoot = await getEffectiveRights(user.id, root.id, MODULE_B);
      const atChild = await getEffectiveRights(user.id, child.id, MODULE_B);
      expect(atRoot).toBe(RIGHT.DELETE);
      expect(atChild).toBe(0);
    });

    it("propagates a recursive assignment down to descendant entities", async () => {
      const profile = await createProfile({ name: `${PREFIX}${RUN_ID}_rec`, interface: "central" });
      const moduleKey = `${PREFIX}module_rec`;
      await setModuleRight(profile.id, moduleKey, RIGHT.CREATE | RIGHT.READ);
      await assignUserProfile({ userId: user.id, profileId: profile.id, entityId: root.id, isRecursive: true });

      const atRoot = await getEffectiveRights(user.id, root.id, moduleKey);
      const atChild = await getEffectiveRights(user.id, child.id, moduleKey);
      expect(atRoot).toBe(RIGHT.CREATE | RIGHT.READ);
      expect(atChild).toBe(RIGHT.CREATE | RIGHT.READ);
    });

    it("does NOT propagate upward from a descendant assignment to an ancestor entity", async () => {
      const profile = await createProfile({ name: `${PREFIX}${RUN_ID}_upward`, interface: "central" });
      await setModuleRight(profile.id, MODULE_C, RIGHT.APPROVE);
      await assignUserProfile({ userId: user.id, profileId: profile.id, entityId: child.id, isRecursive: true });

      const atChild = await getEffectiveRights(user.id, child.id, MODULE_C);
      const atRoot = await getEffectiveRights(user.id, root.id, MODULE_C);
      expect(atChild).toBe(RIGHT.APPROVE);
      expect(atRoot).toBe(0);
    });

    it("unions rights across multiple assignments/profiles granting the same module at the same entity", async () => {
      const moduleKey = `${PREFIX}module_union`;
      const profileOne = await createProfile({ name: `${PREFIX}${RUN_ID}_union1`, interface: "central" });
      const profileTwo = await createProfile({ name: `${PREFIX}${RUN_ID}_union2`, interface: "central" });
      await setModuleRight(profileOne.id, moduleKey, RIGHT.CREATE | RIGHT.READ);
      await setModuleRight(profileTwo.id, moduleKey, RIGHT.DELETE);
      await assignUserProfile({ userId: user.id, profileId: profileOne.id, entityId: root.id, isRecursive: false });
      await assignUserProfile({ userId: user.id, profileId: profileTwo.id, entityId: root.id, isRecursive: false });

      const rights = await getEffectiveRights(user.id, root.id, moduleKey);
      expect(rights).toBe(RIGHT.CREATE | RIGHT.READ | RIGHT.DELETE);
    });
  });
});
