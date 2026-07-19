/**
 * Jest coverage for apps/web/actions/api-clients.actions.ts - part of the previously-untested
 * Server Actions layer (see docs/superpowers/specs/2026-07-19-plan-de-pruebas.md §4.2). This
 * layer's own logic is thin (requireAuthContext -> requireRight -> parseInput -> delegate to a
 * real @itsm/core service -> revalidatePath), so these tests focus on what's unique to the
 * action itself rather than re-testing api-client-service.ts (already covered by
 * packages/core/src/api-clients/api-client-service.test.ts): the RBAC gate really blocks when
 * the right is missing, and parseInput's safe-parse fix (see that helper's own doc comment)
 * really produces a human-readable error instead of zod's raw JSON-blob message.
 *
 * `requireAuthContext` (apps/web/lib/session.ts) and `revalidatePath` (next/cache) are mocked -
 * both are Next.js request-scoped primitives with no meaning in a plain Jest/Node process (no
 * HTTP request, no cookies, no static-generation store to hang a revalidation off). Everything
 * else - requireRight, the real RBAC lookup, createApiClient/revokeApiClient - runs for real
 * against the same dev Postgres the Vitest suite uses. No DB mocks.
 */
import { eq } from "drizzle-orm";
import { apiClients, db } from "@itsm/db";
import { ForbiddenError, MODULE, RIGHT, assignUserProfile, setModuleRight, type AuthContext } from "@itsm/core";
import {
  createTestEntity,
  createTestProfile,
  createTestUser,
  deleteTestEntitiesByPrefix,
  deleteTestProfilesByPrefix,
  deleteTestUsersByPrefix,
} from "../support/fixtures";

const requireAuthContext = jest.fn<Promise<AuthContext>, []>();
jest.mock("@/lib/session", () => ({
  requireAuthContext: () => requireAuthContext(),
}));

const revalidatePath = jest.fn();
jest.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

// Imported after the jest.mock calls above (hoisted by Jest anyway, but keeping the read order
// honest) so the action module picks up the mocked "@/lib/session" and "next/cache".
import { createApiClientAction, revokeApiClientAction } from "../../../apps/web/actions/api-clients.actions";

describe("api-clients.actions", () => {
  let context: AuthContext;
  let contextWithoutRights: AuthContext;

  beforeAll(async () => {
    const entity = await createTestEntity();
    const grantedProfile = await createTestProfile();
    const ungrantedProfile = await createTestProfile();
    const user = await createTestUser();
    const otherUser = await createTestUser();

    await setModuleRight(grantedProfile.id, MODULE.ADVANCED_API, RIGHT.CREATE | RIGHT.DELETE);
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
    // api_clients has a plain (no onDelete) FK to entities - delete the clients this file
    // created before the entity cleanup runs, or that delete fails with a FK violation.
    await db.delete(apiClients).where(eq(apiClients.entityId, context.activeEntity.id));
    await deleteTestUsersByPrefix();
    await deleteTestProfilesByPrefix();
    await deleteTestEntitiesByPrefix();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createApiClientAction", () => {
    it("creates an entity API client and revalidates the setup page when the caller has RIGHT.CREATE", async () => {
      requireAuthContext.mockResolvedValue(context);

      const result = await createApiClientAction({ entityId: context.activeEntity.id, name: "CI integration", scopes: [MODULE.ADVANCED_API] });

      expect(result.client.entityId).toBe(context.activeEntity.id);
      expect(result.rawKey).toMatch(/^sk_/);
      expect(revalidatePath).toHaveBeenCalledWith("/setup/api-clients");
    });

    it("throws ForbiddenError and never calls the service when the caller lacks RIGHT.CREATE", async () => {
      requireAuthContext.mockResolvedValue(contextWithoutRights);

      await expect(
        createApiClientAction({ entityId: contextWithoutRights.activeEntity.id, name: "should not be created", scopes: [MODULE.ADVANCED_API] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("rejects invalid input with a human-readable message, not zod's raw JSON-blob ZodError#message", async () => {
      requireAuthContext.mockResolvedValue(context);

      // scopes: [] fails createApiClientSchema's `.min(1)` - `schema.parse()` would throw a
      // ZodError whose `.message` is a JSON array string (starts with "["); the parseInput
      // helper this action uses instead should rethrow a plain, readable string.
      await expect(createApiClientAction({ entityId: context.activeEntity.id, name: "no scopes", scopes: [] })).rejects.toMatchObject({
        message: expect.not.stringMatching(/^\[/),
      });
    });
  });

  describe("revokeApiClientAction", () => {
    it("revokes the client and revalidates when the caller has RIGHT.DELETE", async () => {
      requireAuthContext.mockResolvedValue(context);
      const created = await createApiClientAction({ entityId: context.activeEntity.id, name: "to revoke", scopes: [MODULE.ADVANCED_API] });
      revalidatePath.mockClear();

      const revoked = await revokeApiClientAction(created.client.id);

      expect(revoked.isActive).toBe(false);
      const [row] = await db.select().from(apiClients).where(eq(apiClients.id, created.client.id));
      expect(row?.isActive).toBe(false);
      expect(revalidatePath).toHaveBeenCalledWith("/setup/api-clients");
    });

    it("throws ForbiddenError when the caller lacks RIGHT.DELETE", async () => {
      requireAuthContext.mockResolvedValue(context);
      const created = await createApiClientAction({ entityId: context.activeEntity.id, name: "protected", scopes: [MODULE.ADVANCED_API] });

      requireAuthContext.mockResolvedValue(contextWithoutRights);
      await expect(revokeApiClientAction(created.client.id)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("propagates the service's not-found error for an id that doesn't exist", async () => {
      requireAuthContext.mockResolvedValue(context);
      await expect(revokeApiClientAction("00000000-0000-0000-0000-000000000000")).rejects.toThrow(/not found/i);
    });
  });
});
