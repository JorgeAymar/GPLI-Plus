import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, resourceVisibilityRules, type Entity, type Group, type Profile, type User } from "@itsm/db";
import {
  addUserToGroup,
  buildAuthContext,
  createTestEntity,
  createTestGroup,
  createTestProfile,
  createTestUser,
  deleteTestEntities,
  deleteTestGroups,
  deleteTestProfiles,
  deleteTestUsers,
} from "../__vitest_tools__/fixtures";
import { addVisibilityRule, isResourceVisibleTo, listVisibilityRules, removeVisibilityRule } from "./visibility-service";

describe("visibility-service", () => {
  const RESOURCE_TYPE = "__vitest_tools__resource";

  let owner: User;
  let stranger: User;
  let groupMember: User;
  let profileHolder: User;
  let rootEntity: Entity;
  let childEntity: Entity;
  let unrelatedEntity: Entity;
  let profile: Profile;
  let otherProfile: Profile;
  let group: Group;

  const entityIds: string[] = [];
  const userIds: string[] = [];
  const profileIds: string[] = [];
  const groupIds: string[] = [];

  beforeAll(async () => {
    rootEntity = await createTestEntity();
    childEntity = await createTestEntity({ parentId: rootEntity.id });
    unrelatedEntity = await createTestEntity();
    entityIds.push(rootEntity.id, childEntity.id, unrelatedEntity.id);

    owner = await createTestUser();
    stranger = await createTestUser();
    groupMember = await createTestUser();
    profileHolder = await createTestUser();
    userIds.push(owner.id, stranger.id, groupMember.id, profileHolder.id);

    profile = await createTestProfile();
    otherProfile = await createTestProfile();
    profileIds.push(profile.id, otherProfile.id);

    group = await createTestGroup(rootEntity.id);
    groupIds.push(group.id);
    await addUserToGroup(groupMember.id, group.id);
  });

  afterAll(async () => {
    await db.delete(resourceVisibilityRules).where(eq(resourceVisibilityRules.resourceType, RESOURCE_TYPE));
    await deleteTestGroups(groupIds);
    await deleteTestProfiles(profileIds);
    await deleteTestUsers(userIds);
    await deleteTestEntities(entityIds);
  });

  it("the owner can always see their own resource, even with zero visibility rules", async () => {
    const context = buildAuthContext(owner, rootEntity, profile);
    const visible = await isResourceVisibleTo(RESOURCE_TYPE, crypto.randomUUID(), owner.id, context);
    expect(visible).toBe(true);
  });

  it("a stranger cannot see a resource with no visibility rules", async () => {
    const context = buildAuthContext(stranger, rootEntity, profile);
    const visible = await isResourceVisibleTo(RESOURCE_TYPE, crypto.randomUUID(), owner.id, context);
    expect(visible).toBe(false);
  });

  it("a direct user-grantee rule grants visibility to that user only", async () => {
    const resourceId = crypto.randomUUID();
    await addVisibilityRule({ resourceType: RESOURCE_TYPE, resourceId, granteeKind: "user", granteeId: stranger.id });

    const strangerContext = buildAuthContext(stranger, rootEntity, profile);
    const otherContext = buildAuthContext(groupMember, rootEntity, profile);

    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, strangerContext)).toBe(true);
    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, otherContext)).toBe(false);
  });

  it("a profile-grantee rule grants visibility to any user with that active profile", async () => {
    const resourceId = crypto.randomUUID();
    await addVisibilityRule({ resourceType: RESOURCE_TYPE, resourceId, granteeKind: "profile", granteeId: profile.id });

    const holderWithMatchingProfile = buildAuthContext(profileHolder, rootEntity, profile);
    const holderWithOtherProfile = buildAuthContext(profileHolder, rootEntity, otherProfile);

    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, holderWithMatchingProfile)).toBe(true);
    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, holderWithOtherProfile)).toBe(false);
  });

  it("a group-grantee rule grants visibility to members of that group only", async () => {
    const resourceId = crypto.randomUUID();
    await addVisibilityRule({ resourceType: RESOURCE_TYPE, resourceId, granteeKind: "group", granteeId: group.id });

    const memberContext = buildAuthContext(groupMember, rootEntity, profile);
    const nonMemberContext = buildAuthContext(stranger, rootEntity, profile);

    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, memberContext)).toBe(true);
    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, nonMemberContext)).toBe(false);
  });

  it("a non-recursive entity-grantee rule only matches the exact active entity", async () => {
    const resourceId = crypto.randomUUID();
    await addVisibilityRule({
      resourceType: RESOURCE_TYPE,
      resourceId,
      granteeKind: "entity",
      granteeId: childEntity.id,
      isRecursive: false,
    });

    const contextAtChild = buildAuthContext(stranger, childEntity, profile);
    const contextAtRoot = buildAuthContext(stranger, rootEntity, profile);
    const contextAtUnrelated = buildAuthContext(stranger, unrelatedEntity, profile);

    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, contextAtChild)).toBe(true);
    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, contextAtRoot)).toBe(false);
    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, contextAtUnrelated)).toBe(false);
  });

  it("a recursive entity-grantee rule on the parent also grants visibility from a child entity", async () => {
    const resourceId = crypto.randomUUID();
    await addVisibilityRule({
      resourceType: RESOURCE_TYPE,
      resourceId,
      granteeKind: "entity",
      granteeId: rootEntity.id,
      isRecursive: true,
    });

    const contextAtChild = buildAuthContext(stranger, childEntity, profile);
    const contextAtUnrelated = buildAuthContext(stranger, unrelatedEntity, profile);

    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, contextAtChild)).toBe(true);
    expect(await isResourceVisibleTo(RESOURCE_TYPE, resourceId, owner.id, contextAtUnrelated)).toBe(false);
  });

  it("listVisibilityRules/removeVisibilityRule perform basic CRUD", async () => {
    const resourceId = crypto.randomUUID();
    const rule = await addVisibilityRule({ resourceType: RESOURCE_TYPE, resourceId, granteeKind: "user", granteeId: stranger.id });

    let rules = await listVisibilityRules(RESOURCE_TYPE, resourceId);
    expect(rules.map((r) => r.id)).toContain(rule.id);

    await removeVisibilityRule(rule.id);

    rules = await listVisibilityRules(RESOURCE_TYPE, resourceId);
    expect(rules.map((r) => r.id)).not.toContain(rule.id);
  });
});
