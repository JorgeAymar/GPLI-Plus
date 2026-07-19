/**
 * Jest coverage for apps/web/actions/rules.actions.ts - the Server Action layer in front of
 * packages/core/src/rules/rule-engine.ts (see tests/jest/core/rule-engine.test.ts for the
 * engine's own behavior). These tests focus on what's unique to the action layer: the RBAC
 * gate (MODULE.SETUP_RULE, RIGHT.CREATE/UPDATE) really blocks when the right is missing, and
 * parseInput's safe-parse fix really produces a human-readable error instead of zod's raw
 * JSON-blob message.
 *
 * `requireAuthContext` (apps/web/lib/session.ts) and `revalidatePath` (next/cache) are mocked -
 * both are Next.js request-scoped primitives with no meaning in a plain Jest/Node process.
 * Everything else - requireRight, the real RBAC lookup, createRule/addRuleCriteria/addRuleAction
 * - runs for real against the same dev Postgres the Vitest suite uses.
 */
import { like } from "drizzle-orm";
import { db, rules } from "@itsm/db";
import { ForbiddenError, MODULE, RIGHT, assignUserProfile, setModuleRight, type AuthContext } from "@itsm/core";
import {
  createTestEntity,
  createTestProfile,
  createTestUser,
  deleteTestEntitiesByPrefix,
  deleteTestProfilesByPrefix,
  deleteTestUsersByPrefix,
  PREFIX,
  uniqueSuffix,
} from "../support/fixtures";

const requireAuthContext = jest.fn<Promise<AuthContext>, []>();
jest.mock("@/lib/session", () => ({
  requireAuthContext: () => requireAuthContext(),
}));

const revalidatePath = jest.fn();
jest.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

import { addRuleActionAction, addRuleCriteriaAction, createRuleAction } from "../../../apps/web/actions/rules.actions";

describe("rules.actions", () => {
  let context: AuthContext;
  let contextWithoutRights: AuthContext;

  beforeAll(async () => {
    const entity = await createTestEntity();
    const grantedProfile = await createTestProfile();
    const ungrantedProfile = await createTestProfile();
    const user = await createTestUser();
    const otherUser = await createTestUser();

    await setModuleRight(grantedProfile.id, MODULE.SETUP_RULE, RIGHT.CREATE | RIGHT.UPDATE);
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
    // rules has a plain (no onDelete) FK to entities - clear rules (which cascade-delete their
    // own criteria/actions) before the entity cleanup runs.
    await db.delete(rules).where(like(rules.name, `${PREFIX}%`));
    await deleteTestUsersByPrefix();
    await deleteTestProfilesByPrefix();
    await deleteTestEntitiesByPrefix();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createRuleAction", () => {
    it("creates a rule and revalidates /setup/rules when the caller has RIGHT.CREATE", async () => {
      requireAuthContext.mockResolvedValue(context);

      const rule = await createRuleAction({ entityId: context.activeEntity.id, ruleType: `${PREFIX}_action_${uniqueSuffix()}`, name: `${PREFIX}_rule` });

      expect(rule.entityId).toBe(context.activeEntity.id);
      expect(revalidatePath).toHaveBeenCalledWith("/setup/rules");
    });

    it("throws ForbiddenError when the caller lacks RIGHT.CREATE", async () => {
      requireAuthContext.mockResolvedValue(contextWithoutRights);

      await expect(
        createRuleAction({ entityId: contextWithoutRights.activeEntity.id, ruleType: `${PREFIX}_action_${uniqueSuffix()}`, name: `${PREFIX}_denied` }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("rejects invalid input with a human-readable message, not zod's raw JSON-blob ZodError#message", async () => {
      requireAuthContext.mockResolvedValue(context);

      await expect(
        createRuleAction({ entityId: context.activeEntity.id, ruleType: `${PREFIX}_action_${uniqueSuffix()}`, name: "" }),
      ).rejects.toMatchObject({
        message: expect.not.stringMatching(/^\[/),
      });
    });
  });

  describe("addRuleCriteriaAction / addRuleActionAction", () => {
    it("adds a criterion and an action to an existing rule when the caller has RIGHT.UPDATE, revalidating the rule's detail page", async () => {
      requireAuthContext.mockResolvedValue(context);
      const rule = await createRuleAction({ entityId: context.activeEntity.id, ruleType: `${PREFIX}_action_${uniqueSuffix()}`, name: `${PREFIX}_rule_detail` });
      revalidatePath.mockClear();

      const criterion = await addRuleCriteriaAction({ ruleId: rule.id, field: "title", operator: "contains", value: "urgent" });
      expect(criterion.ruleId).toBe(rule.id);
      expect(revalidatePath).toHaveBeenCalledWith(`/setup/rules/${rule.id}`);

      revalidatePath.mockClear();
      const action = await addRuleActionAction({ ruleId: rule.id, actionType: "assign", field: "priority", value: "5" });
      expect(action.ruleId).toBe(rule.id);
      expect(revalidatePath).toHaveBeenCalledWith(`/setup/rules/${rule.id}`);
    });

    it("throws ForbiddenError for addRuleCriteriaAction/addRuleActionAction when the caller lacks RIGHT.UPDATE", async () => {
      requireAuthContext.mockResolvedValue(context);
      const rule = await createRuleAction({ entityId: context.activeEntity.id, ruleType: `${PREFIX}_action_${uniqueSuffix()}`, name: `${PREFIX}_rule_locked` });

      requireAuthContext.mockResolvedValue(contextWithoutRights);
      await expect(addRuleCriteriaAction({ ruleId: rule.id, field: "title", operator: "is", value: "x" })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(addRuleActionAction({ ruleId: rule.id, actionType: "assign", field: "priority", value: "5" })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });
});
