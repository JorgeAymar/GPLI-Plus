import "dotenv/config";
import { db, entities, groups, users, type Entity, type Group, type User } from "@itsm/db";
import { desc, eq, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createUser } from "../users/user-service";
import {
  addUserToGroup,
  createGroup,
  getGroup,
  listGroupMembers,
  listGroups,
  listGroupsForUser,
  removeUserFromGroup,
  updateGroup,
} from "./group-service";

const PREFIX = "__vitest_rbac__group_svc_";
const RUN_ID = randomUUID().slice(0, 8);

describe("group-service", () => {
  let root: Entity;
  let child: Entity;
  let userA: User;
  let userB: User;

  beforeAll(async () => {
    root = await createEntity({ name: `${PREFIX}root` });
    child = await createEntity({ name: `${PREFIX}child`, parentId: root.id });
    userA = await createUser({
      email: `${PREFIX}${RUN_ID}_a@example.test`,
      username: `${PREFIX}${RUN_ID}_a`,
      password: "supersecret",
      displayName: "Vitest User A",
    });
    userB = await createUser({
      email: `${PREFIX}${RUN_ID}_b@example.test`,
      username: `${PREFIX}${RUN_ID}_b`,
      password: "supersecret",
      displayName: "Vitest User B",
    });
  });

  afterAll(async () => {
    // FK order: groups reference entities (no cascade) - delete groups first.
    const groupRows = await db.select({ id: groups.id }).from(groups).where(like(groups.name, `${PREFIX}%`));
    for (const row of groupRows) {
      await db.delete(groups).where(eq(groups.id, row.id));
    }
    // user_groups cascades on user delete, so users can go next.
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
    // entities last (deepest level first, self-referencing parent_id).
    const entityRows = await db
      .select({ id: entities.id })
      .from(entities)
      .where(like(entities.name, `${PREFIX}%`))
      .orderBy(desc(entities.level));
    for (const row of entityRows) {
      await db.delete(entities).where(eq(entities.id, row.id));
    }
  });

  describe("createGroup / getGroup / updateGroup", () => {
    let group: Group;

    it("creates a group defaulting isActive to true", async () => {
      group = await createGroup({ entityId: root.id, name: `${PREFIX}${RUN_ID}_g1` });
      expect(group.entityId).toBe(root.id);
      expect(group.isActive).toBe(true);
    });

    it("fetches the group by id", async () => {
      const found = await getGroup(group.id);
      expect(found?.id).toBe(group.id);
    });

    it("returns undefined for an unknown group id", async () => {
      const found = await getGroup("00000000-0000-0000-0000-000000000000");
      expect(found).toBeUndefined();
    });

    it("renames a group via updateGroup", async () => {
      const updated = await updateGroup(group.id, { name: `${PREFIX}${RUN_ID}_g1_renamed` });
      expect(updated.name).toBe(`${PREFIX}${RUN_ID}_g1_renamed`);
    });

    it("throws when updating an unknown group id", async () => {
      await expect(updateGroup("00000000-0000-0000-0000-000000000000", { name: "x" })).rejects.toThrow(/not found/i);
    });
  });

  describe("listGroups", () => {
    it("excludes inactive groups from the default (non-subtree) listing", async () => {
      const activeGroup = await createGroup({ entityId: root.id, name: `${PREFIX}${RUN_ID}_active` });
      const inactiveGroup = await createGroup({ entityId: root.id, name: `${PREFIX}${RUN_ID}_inactive` });
      await updateGroup(inactiveGroup.id, { isActive: false });

      const listed = await listGroups(root.id);
      const ids = listed.map((g) => g.id);
      expect(ids).toContain(activeGroup.id);
      expect(ids).not.toContain(inactiveGroup.id);
    });

    it("without includeSubtree, does not return a child entity's groups", async () => {
      const childGroup = await createGroup({ entityId: child.id, name: `${PREFIX}${RUN_ID}_child_group` });
      const listed = await listGroups(root.id);
      expect(listed.map((g) => g.id)).not.toContain(childGroup.id);
    });

    it("with includeSubtree: true, returns groups from descendant entities too", async () => {
      const childGroup = await createGroup({ entityId: child.id, name: `${PREFIX}${RUN_ID}_child_group2` });
      const listed = await listGroups(root.id, { includeSubtree: true });
      expect(listed.map((g) => g.id)).toContain(childGroup.id);
    });
  });

  describe("group membership", () => {
    it("a freshly created group has no members", async () => {
      const group = await createGroup({ entityId: root.id, name: `${PREFIX}${RUN_ID}_empty` });
      const members = await listGroupMembers(group.id);
      expect(members).toEqual([]);
    });

    it("adds a user to a group with isManager defaulting to false", async () => {
      const group = await createGroup({ entityId: root.id, name: `${PREFIX}${RUN_ID}_members` });
      await addUserToGroup(userA.id, group.id);

      const members = await listGroupMembers(group.id);
      expect(members).toEqual([{ userId: userA.id, displayName: userA.displayName, isManager: false }]);
    });

    it("re-adding the same user with isManager: true updates the row instead of duplicating it", async () => {
      const group = await createGroup({ entityId: root.id, name: `${PREFIX}${RUN_ID}_promote` });
      await addUserToGroup(userA.id, group.id, false);
      await addUserToGroup(userA.id, group.id, true);

      const members = await listGroupMembers(group.id);
      expect(members).toHaveLength(1);
      expect(members[0]).toEqual({ userId: userA.id, displayName: userA.displayName, isManager: true });
    });

    it("removes a user from a group", async () => {
      const group = await createGroup({ entityId: root.id, name: `${PREFIX}${RUN_ID}_remove` });
      await addUserToGroup(userA.id, group.id);
      await removeUserFromGroup(userA.id, group.id);

      const members = await listGroupMembers(group.id);
      expect(members).toEqual([]);
    });

    it("listGroupsForUser returns every group a user belongs to", async () => {
      const groupOne = await createGroup({ entityId: root.id, name: `${PREFIX}${RUN_ID}_ug1` });
      const groupTwo = await createGroup({ entityId: root.id, name: `${PREFIX}${RUN_ID}_ug2` });
      await addUserToGroup(userB.id, groupOne.id);
      await addUserToGroup(userB.id, groupTwo.id);

      const forUser = await listGroupsForUser(userB.id);
      expect(forUser.map((g) => g.id).sort()).toEqual([groupOne.id, groupTwo.id].sort());
    });
  });
});
