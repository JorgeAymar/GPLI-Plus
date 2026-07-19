/**
 * Jest coverage for apps/web/actions/account.actions.ts. Unlike api-clients.actions.ts, these
 * actions are self-service (no requireRight gate) - the interesting, action-layer-specific
 * behavior here is the ownership boundary: revokeMyApiClientAction must thread the
 * *server-resolved* context.user.id into the ownership check, not anything client-supplied, so
 * one user can never revoke another user's personal token by guessing its id (an IDOR guard).
 * That check itself lives in api-client-service.ts's revokeMyApiClient (already covered by
 * packages/core's own test suite) - what's tested here is that the action really wires the
 * real session's user id through end to end, against the real DB, not a stub.
 *
 * `requireAuthContext` (apps/web/lib/session.ts), `revalidatePath` (next/cache), and
 * `unstable_update` (apps/web/lib/auth.ts) are mocked - all three are Next.js/Auth.js
 * request-scoped primitives with no meaning in a plain Jest/Node process. Everything else runs
 * for real against the same dev Postgres the Vitest suite uses.
 */
import { eq } from "drizzle-orm";
import { apiClients, db } from "@itsm/db";
import { type AuthContext } from "@itsm/core";
import { createTestEntity, createTestProfile, createTestUser, deleteTestEntitiesByPrefix, deleteTestProfilesByPrefix, deleteTestUsersByPrefix } from "../support/fixtures";

const requireAuthContext = jest.fn<Promise<AuthContext>, []>();
jest.mock("@/lib/session", () => ({
  requireAuthContext: () => requireAuthContext(),
}));

const revalidatePath = jest.fn();
jest.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

const unstableUpdate = jest.fn();
jest.mock("@/lib/auth", () => ({
  unstable_update: (input: unknown) => unstableUpdate(input),
}));

import {
  createMyApiClientAction,
  listMyApiClientsAction,
  revokeMyApiClientAction,
  updateMyLanguageAction,
} from "../../../apps/web/actions/account.actions";

describe("account.actions", () => {
  let contextA: AuthContext;
  let contextB: AuthContext;

  beforeAll(async () => {
    const entity = await createTestEntity();
    const profile = await createTestProfile();
    const userA = await createTestUser();
    const userB = await createTestUser();
    contextA = { user: userA, activeEntity: entity, activeProfile: profile, isRecursive: true };
    contextB = { user: userB, activeEntity: entity, activeProfile: profile, isRecursive: true };
  });

  afterAll(async () => {
    await db.delete(apiClients).where(eq(apiClients.userId, contextA.user.id));
    await db.delete(apiClients).where(eq(apiClients.userId, contextB.user.id));
    await deleteTestUsersByPrefix();
    await deleteTestProfilesByPrefix();
    await deleteTestEntitiesByPrefix();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createMyApiClientAction / listMyApiClientsAction", () => {
    it("creates a personal token owned by the session's user, with no RBAC gate", async () => {
      requireAuthContext.mockResolvedValue(contextA);

      const result = await createMyApiClientAction({ name: "my laptop" });

      expect(result.client.userId).toBe(contextA.user.id);
      expect(result.rawKey).toMatch(/^pat_/);
      expect(revalidatePath).toHaveBeenCalledWith("/account");
    });

    it("listMyApiClientsAction only returns the calling user's own tokens", async () => {
      requireAuthContext.mockResolvedValue(contextA);
      await createMyApiClientAction({ name: "userA token" });

      requireAuthContext.mockResolvedValue(contextB);
      await createMyApiClientAction({ name: "userB token" });

      requireAuthContext.mockResolvedValue(contextA);
      const clientsForA = await listMyApiClientsAction();

      expect(clientsForA.length).toBeGreaterThan(0);
      expect(clientsForA.every((c) => c.userId === contextA.user.id)).toBe(true);
    });
  });

  describe("revokeMyApiClientAction (ownership / IDOR guard)", () => {
    it("revokes the caller's own token", async () => {
      requireAuthContext.mockResolvedValue(contextA);
      const created = await createMyApiClientAction({ name: "revoke me" });
      revalidatePath.mockClear();

      const revoked = await revokeMyApiClientAction(created.client.id);

      expect(revoked.isActive).toBe(false);
      expect(revalidatePath).toHaveBeenCalledWith("/account");
    });

    it("refuses to revoke another user's token even though the id is a real, existing api_clients row", async () => {
      requireAuthContext.mockResolvedValue(contextB);
      const belongsToB = await createMyApiClientAction({ name: "userB private token" });

      // Same server process, but now the *session* resolves to a different user - this is
      // exactly the scenario an IDOR attempt looks like: attacker knows/guesses a valid
      // client id that belongs to someone else.
      requireAuthContext.mockResolvedValue(contextA);
      await expect(revokeMyApiClientAction(belongsToB.client.id)).rejects.toThrow(/not found/i);

      const [stillActive] = await db.select().from(apiClients).where(eq(apiClients.id, belongsToB.client.id));
      expect(stillActive?.isActive).toBe(true);
    });
  });

  describe("updateMyLanguageAction", () => {
    it("persists the new language, mirrors it into the JWT via unstable_update, and revalidates", async () => {
      requireAuthContext.mockResolvedValue(contextA);

      const updated = await updateMyLanguageAction({ language: "fr" });

      expect(updated.language).toBe("fr");
      expect(unstableUpdate).toHaveBeenCalledWith({ language: "fr" });
      expect(revalidatePath).toHaveBeenCalledWith("/account");
    });

    it("rejects an unsupported language code with a human-readable message, not zod's raw JSON-blob ZodError#message", async () => {
      requireAuthContext.mockResolvedValue(contextA);

      await expect(updateMyLanguageAction({ language: "not-a-real-locale" })).rejects.toMatchObject({
        message: expect.not.stringMatching(/^\[/),
      });
      expect(unstableUpdate).not.toHaveBeenCalled();
    });
  });
});
