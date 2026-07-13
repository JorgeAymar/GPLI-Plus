import "dotenv/config";
import { db, entities, profiles, users, type Entity, type Profile, type User } from "@itsm/db";
import { desc, eq, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { assignUserProfile, createProfile, setModuleRight } from "../rbac/profile-service";
import { createUser } from "../users/user-service";
import type { AuthContext } from "./get-auth-context";
import { ForbiddenError, hasRight, requireRight, RIGHT } from "./permissions";

const PREFIX = "__vitest_rbac__permissions_";
const RUN_ID = randomUUID().slice(0, 8);
const MODULE_WITH_RIGHTS = `${PREFIX}module_granted`;
const MODULE_WITHOUT_RIGHTS = `${PREFIX}module_ungranted`;

describe("hasRight (pure bitmask logic)", () => {
  const granted = RIGHT.CREATE | RIGHT.READ;

  it("returns true when the exact single required bit is present", () => {
    expect(hasRight(granted, RIGHT.CREATE)).toBe(true);
    expect(hasRight(granted, RIGHT.READ)).toBe(true);
  });

  it("returns false when the required bit is absent", () => {
    expect(hasRight(granted, RIGHT.UPDATE)).toBe(false);
    expect(hasRight(granted, RIGHT.DELETE)).toBe(false);
  });

  it("returns true when all required bits in a combined mask are present", () => {
    expect(hasRight(granted, RIGHT.CREATE | RIGHT.READ)).toBe(true);
  });

  it("returns false when only some bits of a combined mask are present (CREATE+READ does not imply UPDATE)", () => {
    expect(hasRight(granted, RIGHT.CREATE | RIGHT.UPDATE)).toBe(false);
  });

  it("returns true for a required mask of 0 (no rights required)", () => {
    expect(hasRight(0, 0)).toBe(true);
    expect(hasRight(granted, 0)).toBe(true);
  });

  it("returns false when the user has no rights at all", () => {
    expect(hasRight(0, RIGHT.READ)).toBe(false);
  });
});

describe("requireRight (integration, real getEffectiveRights lookup)", () => {
  let entity: Entity;
  let profile: Profile;
  let user: User;
  let context: AuthContext;

  beforeAll(async () => {
    entity = await createEntity({ name: `${PREFIX}entity` });
    profile = await createProfile({ name: `${PREFIX}${RUN_ID}_profile`, interface: "central" });
    user = await createUser({
      email: `${PREFIX}${RUN_ID}@example.test`,
      username: `${PREFIX}${RUN_ID}`,
      password: "supersecret",
      displayName: "Vitest Permissions User",
    });
    await setModuleRight(profile.id, MODULE_WITH_RIGHTS, RIGHT.READ | RIGHT.CREATE);
    await assignUserProfile({ userId: user.id, profileId: profile.id, entityId: entity.id, isRecursive: true });

    context = { user, activeEntity: entity, activeProfile: profile, isRecursive: true };
  });

  afterAll(async () => {
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

  it("resolves without throwing when the user has the exact required right", async () => {
    await expect(requireRight(context, MODULE_WITH_RIGHTS, RIGHT.READ)).resolves.toBeUndefined();
  });

  it("resolves without throwing when the user has a combined mask they fully satisfy", async () => {
    await expect(requireRight(context, MODULE_WITH_RIGHTS, RIGHT.READ | RIGHT.CREATE)).resolves.toBeUndefined();
  });

  it("throws ForbiddenError when the user lacks the required right", async () => {
    await expect(requireRight(context, MODULE_WITH_RIGHTS, RIGHT.UPDATE)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws ForbiddenError when the user has only part of a combined required mask", async () => {
    await expect(requireRight(context, MODULE_WITH_RIGHTS, RIGHT.CREATE | RIGHT.UPDATE)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws ForbiddenError for a module the user has no rights on at all", async () => {
    await expect(requireRight(context, MODULE_WITHOUT_RIGHTS, RIGHT.READ)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("ForbiddenError carries the module key and required mask in its message", async () => {
    try {
      await requireRight(context, MODULE_WITHOUT_RIGHTS, RIGHT.DELETE);
      expect.unreachable("requireRight should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as Error).name).toBe("ForbiddenError");
      expect((err as Error).message).toContain(MODULE_WITHOUT_RIGHTS);
      expect((err as Error).message).toContain(String(RIGHT.DELETE));
    }
  });
});
