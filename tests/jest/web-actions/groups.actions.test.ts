/**
 * Jest coverage for apps/web/actions/groups.actions.ts. These tests focus on what's unique to
 * the action layer: the RBAC gate (MODULE.ADMINISTRATION_GROUP, RIGHT.CREATE/ASSIGN), the audit
 * log's real branching logic (`group?.entityId ?? context.activeEntity.id` - the group's own
 * entity when it exists, falling back to the caller's active entity when it doesn't), and input
 * validation's error shape.
 *
 * `requireAuthContext` (apps/web/lib/session.ts) and `revalidatePath` (next/cache) are mocked -
 * both are Next.js request-scoped primitives with no meaning in a plain Jest/Node process.
 * Everything else - requireRight, the real RBAC lookup, createGroup/addUserToGroup/
 * removeUserFromGroup/recordAuditLog - runs for real against the same dev Postgres the Vitest
 * suite uses.
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { auditLog, db, groups, userGroups } from "@itsm/db";
import { ForbiddenError, MODULE, RIGHT, assignUserProfile, setModuleRight, type AuthContext } from "@itsm/core";
import {
  createTestEntity,
  createTestProfile,
  createTestUser,
  deleteTestEntitiesByPrefix,
  deleteTestProfilesByPrefix,
  deleteTestUsersByPrefix,
  PREFIX,
} from "../support/fixtures";

const requireAuthContext = jest.fn<Promise<AuthContext>, []>();
jest.mock("@/lib/session", () => ({
  requireAuthContext: () => requireAuthContext(),
}));

const revalidatePath = jest.fn();
jest.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

import { addUserToGroupAction, createGroupAction, removeUserFromGroupAction } from "../../../apps/web/actions/groups.actions";

describe("groups.actions", () => {
  let context: AuthContext;
  let contextWithoutRights: AuthContext;
  let memberUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    const entity = await createTestEntity();
    const grantedProfile = await createTestProfile();
    const ungrantedProfile = await createTestProfile();
    const user = await createTestUser();
    const otherUser = await createTestUser();
    memberUser = await createTestUser();

    await setModuleRight(grantedProfile.id, MODULE.ADMINISTRATION_GROUP, RIGHT.CREATE | RIGHT.ASSIGN);
    await assignUserProfile({ userId: user.id, profileId: grantedProfile.id, entityId: entity.id, isRecursive: true, isDefault: true });
    await assignUserProfile({
      userId: otherUser.id,
      profileId: ungrantedProfile.id,
      entityId: entity.id,
      isRecursive: true,
      isDefault: true,
    });

    context = { user, activeEntity: entity, activeProfile: grantedProfile, isRecursive: true };
    contextWithoutRights = { user: otherUser, activeEntity: entity, activeProfile: ungrantedProfile, isRecursive: true };
  });

  afterAll(async () => {
    await db.delete(auditLog).where(eq(auditLog.entityId, context.activeEntity.id));
    await db.delete(groups).where(eq(groups.entityId, context.activeEntity.id));
    await deleteTestUsersByPrefix();
    await deleteTestProfilesByPrefix();
    await deleteTestEntitiesByPrefix();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createGroupAction", () => {
    it("creates a group, records an audit log entry, and revalidates /administration/groups", async () => {
      requireAuthContext.mockResolvedValue(context);

      const group = await createGroupAction({ entityId: context.activeEntity.id, name: `${PREFIX}_group_create` });

      expect(group.entityId).toBe(context.activeEntity.id);
      expect(revalidatePath).toHaveBeenCalledWith("/administration/groups");

      const [logRow] = await db
        .select()
        .from(auditLog)
        .where(inArray(auditLog.objectId, [group.id]));
      expect(logRow?.action).toBe("create");
      expect(logRow?.objectType).toBe("group");
      expect(logRow?.actorUserId).toBe(context.user.id);
      expect(logRow?.entityId).toBe(group.entityId);
    });

    it("throws ForbiddenError when the caller lacks RIGHT.CREATE", async () => {
      requireAuthContext.mockResolvedValue(contextWithoutRights);

      await expect(createGroupAction({ entityId: contextWithoutRights.activeEntity.id, name: `${PREFIX}_should_not_exist` })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("rejects invalid input with a human-readable message, not zod's raw JSON-blob ZodError#message", async () => {
      requireAuthContext.mockResolvedValue(context);

      await expect(createGroupAction({ entityId: context.activeEntity.id, name: "" })).rejects.toMatchObject({
        message: expect.not.stringMatching(/^\[/),
      });
    });
  });

  describe("addUserToGroupAction / removeUserFromGroupAction (entity-resolution branching in the audit log)", () => {
    it("addUserToGroupAction records the audit entry under the *group's own* entity, adds the membership, and revalidates the group's detail page", async () => {
      requireAuthContext.mockResolvedValue(context);
      const group = await createGroupAction({ entityId: context.activeEntity.id, name: `${PREFIX}_group_add_member` });
      revalidatePath.mockClear();

      await addUserToGroupAction({ userId: memberUser.id, groupId: group.id, isManager: true });

      const [membership] = await db
        .select()
        .from(userGroups)
        .where(eq(userGroups.groupId, group.id));
      expect(membership?.userId).toBe(memberUser.id);
      expect(membership?.isManager).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith(`/administration/groups/${group.id}`);

      // This is a real, shared dev Postgres (not an isolated test DB), so scope the lookup by
      // this exact group's id - a bare `objectType = "group_member"` filter could otherwise
      // match unrelated pre-existing audit rows from manual/E2E usage of the real app.
      const [logRow] = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.objectType, "group_member"), eq(auditLog.objectId, group.id)));
      expect(logRow?.entityId).toBe(group.entityId);
    });

    it("throws ForbiddenError for addUserToGroupAction/removeUserFromGroupAction when the caller lacks RIGHT.ASSIGN", async () => {
      requireAuthContext.mockResolvedValue(context);
      const group = await createGroupAction({ entityId: context.activeEntity.id, name: `${PREFIX}_group_locked` });

      requireAuthContext.mockResolvedValue(contextWithoutRights);
      await expect(addUserToGroupAction({ userId: memberUser.id, groupId: group.id })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(removeUserFromGroupAction(memberUser.id, group.id)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("removeUserFromGroupAction against a groupId that no longer exists falls back to the caller's active entity for the audit log, instead of throwing", async () => {
      requireAuthContext.mockResolvedValue(context);
      const goneGroupId = randomUUID();

      await expect(removeUserFromGroupAction(memberUser.id, goneGroupId)).resolves.toBeUndefined();

      const [logRow] = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.objectId, goneGroupId));
      expect(logRow?.entityId).toBe(context.activeEntity.id);
      expect(logRow?.action).toBe("delete");
    });
  });
});
