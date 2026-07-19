/**
 * Jest coverage for apps/web/actions/tickets.actions.ts - the highest-traffic module in the
 * app (Asistencia > Tickets). These tests focus on what's unique to the action layer: the RBAC
 * gate (MODULE.ASSISTANCE_TICKET, RIGHT.CREATE/UPDATE) really blocks when the right is missing,
 * the extra /portal revalidation on ticket creation, and input validation's error shape.
 *
 * `requireAuthContext` (apps/web/lib/session.ts) and `revalidatePath` (next/cache) are mocked -
 * both are Next.js request-scoped primitives with no meaning in a plain Jest/Node process.
 * Everything else - requireRight, the real RBAC lookup, createTicket/updateTicket/
 * updateTicketStatus - runs for real against the same dev Postgres the Vitest suite uses.
 */
import { eq, inArray } from "drizzle-orm";
import { auditLog, db, queuedNotifications, tickets } from "@itsm/db";
import { ForbiddenError, MODULE, RIGHT, assignUserProfile, setModuleRight, type AuthContext } from "@itsm/core";
import { createTestEntity, createTestProfile, createTestUser, deleteTestEntitiesByPrefix, deleteTestProfilesByPrefix, deleteTestUsersByPrefix } from "../support/fixtures";

const requireAuthContext = jest.fn<Promise<AuthContext>, []>();
jest.mock("@/lib/session", () => ({
  requireAuthContext: () => requireAuthContext(),
}));

const revalidatePath = jest.fn();
jest.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

import { createTicketAction, updateTicketAction, updateTicketStatusAction } from "../../../apps/web/actions/tickets.actions";

describe("tickets.actions", () => {
  let context: AuthContext;
  let contextWithoutRights: AuthContext;

  beforeAll(async () => {
    const entity = await createTestEntity();
    const grantedProfile = await createTestProfile();
    const ungrantedProfile = await createTestProfile();
    const user = await createTestUser();
    const otherUser = await createTestUser();

    await setModuleRight(grantedProfile.id, MODULE.ASSISTANCE_TICKET, RIGHT.CREATE | RIGHT.UPDATE);
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
    await db.delete(tickets).where(eq(tickets.entityId, context.activeEntity.id));
    // Ticket creation/updates also record audit_log rows (actor_user_id -> users) and queue
    // notifications (recipient_user_id -> users) - neither FK has onDelete cascade, so both
    // need clearing before the user cleanup runs, or it fails with a FK violation.
    await db.delete(auditLog).where(eq(auditLog.entityId, context.activeEntity.id));
    await db.delete(queuedNotifications).where(inArray(queuedNotifications.recipientUserId, [context.user.id, contextWithoutRights.user.id]));
    await deleteTestUsersByPrefix();
    await deleteTestProfilesByPrefix();
    await deleteTestEntitiesByPrefix();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createTicketAction", () => {
    it("creates a ticket and revalidates both /assistance/tickets and /portal when the caller has RIGHT.CREATE", async () => {
      requireAuthContext.mockResolvedValue(context);

      const ticket = await createTicketAction({ entityId: context.activeEntity.id, title: "Printer is down", content: "It won't turn on." });

      expect(ticket.entityId).toBe(context.activeEntity.id);
      expect(revalidatePath).toHaveBeenCalledWith("/assistance/tickets");
      expect(revalidatePath).toHaveBeenCalledWith("/portal");
    });

    it("throws ForbiddenError and never revalidates when the caller lacks RIGHT.CREATE", async () => {
      requireAuthContext.mockResolvedValue(contextWithoutRights);

      await expect(
        createTicketAction({ entityId: contextWithoutRights.activeEntity.id, title: "should not be created", content: "x" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    // Regression test for a real bug found while writing this suite: unlike
    // apps/web/actions/api-clients.actions.ts, account.actions.ts and rules.actions.ts (which
    // all use a `parseInput` helper wrapping zod's `.safeParse` specifically to avoid this),
    // tickets.actions.ts called `createTicketSchema.parse(input)` directly. zod's ZodError
    // `.message` getter returns a raw JSON-stringified array of issues, not a human-readable
    // string - every "Crear X" form in this app surfaces action errors via `err.message`, so a
    // user submitting an empty ticket title would see a JSON blob dumped in the UI instead of a
    // real validation message. Fixed by switching tickets.actions.ts to the same parseInput
    // helper the other action files already use.
    it("rejects invalid input with a human-readable message, not zod's raw JSON-blob ZodError#message", async () => {
      requireAuthContext.mockResolvedValue(context);

      await expect(createTicketAction({ entityId: context.activeEntity.id, title: "", content: "x" })).rejects.toMatchObject({
        message: expect.not.stringMatching(/^\[/),
      });
    });
  });

  describe("updateTicketAction", () => {
    it("updates a ticket and revalidates its detail page when the caller has RIGHT.UPDATE", async () => {
      requireAuthContext.mockResolvedValue(context);
      const ticket = await createTicketAction({ entityId: context.activeEntity.id, title: "Original title", content: "x" });
      revalidatePath.mockClear();

      const updated = await updateTicketAction(ticket.id, { title: "Updated title" });

      expect(updated.title).toBe("Updated title");
      expect(revalidatePath).toHaveBeenCalledWith(`/assistance/tickets/${ticket.id}`);
    });

    it("throws ForbiddenError when the caller lacks RIGHT.UPDATE", async () => {
      requireAuthContext.mockResolvedValue(context);
      const ticket = await createTicketAction({ entityId: context.activeEntity.id, title: "Locked", content: "x" });

      requireAuthContext.mockResolvedValue(contextWithoutRights);
      await expect(updateTicketAction(ticket.id, { title: "should not apply" })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("rejects invalid input (title exceeding max length) with a human-readable message, not a JSON blob", async () => {
      requireAuthContext.mockResolvedValue(context);
      const ticket = await createTicketAction({ entityId: context.activeEntity.id, title: "Original", content: "x" });

      await expect(updateTicketAction(ticket.id, { title: "x".repeat(300) })).rejects.toMatchObject({
        message: expect.not.stringMatching(/^\[/),
      });
    });
  });

  describe("updateTicketStatusAction", () => {
    it("transitions status and stamps solvedAt when moving to 'solved'", async () => {
      requireAuthContext.mockResolvedValue(context);
      const ticket = await createTicketAction({ entityId: context.activeEntity.id, title: "Status test", content: "x" });
      revalidatePath.mockClear();

      const updated = await updateTicketStatusAction(ticket.id, "solved");

      expect(updated.status).toBe("solved");
      expect(updated.solvedAt).not.toBeNull();
      expect(revalidatePath).toHaveBeenCalledWith(`/assistance/tickets/${ticket.id}`);
    });

    it("throws ForbiddenError when the caller lacks RIGHT.UPDATE", async () => {
      requireAuthContext.mockResolvedValue(context);
      const ticket = await createTicketAction({ entityId: context.activeEntity.id, title: "Status locked", content: "x" });

      requireAuthContext.mockResolvedValue(contextWithoutRights);
      await expect(updateTicketStatusAction(ticket.id, "closed")).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("rejects an invalid status with a human-readable message, not zod's raw JSON-blob ZodError#message", async () => {
      requireAuthContext.mockResolvedValue(context);
      const ticket = await createTicketAction({ entityId: context.activeEntity.id, title: "Bad status", content: "x" });

      await expect(updateTicketStatusAction(ticket.id, "not-a-real-status")).rejects.toMatchObject({
        message: expect.not.stringMatching(/^\[/),
      });
    });
  });
});
