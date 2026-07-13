import {
  auditLog,
  db,
  entities,
  itilActors,
  itilCosts,
  itilTimelineItems,
  itilValidations,
  queuedNotifications,
  tickets,
  users,
  type Entity,
  type User,
} from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createUser } from "../users/user-service";
import {
  addActor,
  addCost,
  addTimelineItem,
  addValidation,
  listActors,
  listCosts,
  listTimelineItems,
  listValidations,
  removeActor,
  respondToValidation,
} from "./itil-shared-service";
import { createTicket } from "./ticket-service";

const PREFIX = "__vitest_itil__itil_shared";

let entity: Entity;
let creator: User;
let otherUser: User;
let ticketId: string;

beforeAll(async () => {
  entity = await createEntity({ name: `${PREFIX}_entity_${Date.now()}` });
  creator = await createUser({
    email: `${PREFIX}_creator_${Date.now()}@example.test`,
    username: `${PREFIX}_creator_${Date.now()}`,
    password: "not-used-in-tests",
    displayName: `${PREFIX} creator`,
  });
  otherUser = await createUser({
    email: `${PREFIX}_other_${Date.now()}@example.test`,
    username: `${PREFIX}_other_${Date.now()}`,
    password: "not-used-in-tests",
    displayName: `${PREFIX} other`,
  });

  // A real ticket to hang the satellite rows off of - itil_actors/itil_timeline_items/etc have
  // no actual FK to tickets.id (polymorphic by design), but exercising this against a real
  // parent mirrors how the app actually uses these functions.
  const ticket = await createTicket({ entityId: entity.id, title: "Shared satellites host ticket", content: "content" }, creator.id);
  ticketId = ticket.id;
});

afterAll(async () => {
  await db.delete(itilCosts).where(eq(itilCosts.itilId, ticketId));
  await db.delete(itilValidations).where(eq(itilValidations.itilId, ticketId));
  await db.delete(itilTimelineItems).where(eq(itilTimelineItems.itilId, ticketId));
  await db.delete(itilActors).where(eq(itilActors.itilId, ticketId));
  await db.delete(queuedNotifications).where(inArray(queuedNotifications.recipientUserId, [creator.id, otherUser.id]));
  await db.delete(auditLog).where(eq(auditLog.entityId, entity.id));
  await db.delete(tickets).where(eq(tickets.id, ticketId));
  await db.delete(entities).where(eq(entities.id, entity.id));
  await db.delete(users).where(inArray(users.id, [creator.id, otherUser.id]));
});

describe("itil-shared-service", () => {
  describe("actors", () => {
    it("addActor/listActors expose every actor attached to an itil object", async () => {
      await addActor("ticket", ticketId, { actorRole: "assignee", actorKind: "user", actorId: otherUser.id });

      const actors = await listActors("ticket", ticketId);
      // requester (auto-added by createTicket) + the assignee we just added.
      expect(actors.length).toBeGreaterThanOrEqual(2);
      expect(actors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actorRole: "requester", actorId: creator.id }),
          expect.objectContaining({ actorRole: "assignee", actorId: otherUser.id }),
        ]),
      );
    });

    it("removeActor removes only the targeted actor row", async () => {
      const observer = await addActor("ticket", ticketId, { actorRole: "observer", actorKind: "user", actorId: otherUser.id });

      await removeActor(observer.id);

      const actors = await listActors("ticket", ticketId);
      expect(actors.map((a) => a.id)).not.toContain(observer.id);
    });
  });

  describe("timeline", () => {
    it("addTimelineItem/listTimelineItems round-trip with defaults", async () => {
      const item = await addTimelineItem("ticket", ticketId, { itemType: "followup", content: "Llamé al usuario.", createdBy: creator.id });

      expect(item.isPrivate).toBe(false);
      expect(item.timeSpentMinutes).toBeNull();

      const items = await listTimelineItems("ticket", ticketId);
      expect(items.map((i) => i.id)).toContain(item.id);
    });

    it("supports private internal notes with time tracking", async () => {
      const note = await addTimelineItem("ticket", ticketId, {
        itemType: "internal_note",
        content: "Nota interna.",
        isPrivate: true,
        createdBy: creator.id,
        timeSpentMinutes: 15,
      });

      expect(note.isPrivate).toBe(true);
      expect(note.timeSpentMinutes).toBe(15);
    });
  });

  describe("validations", () => {
    it("addValidation starts in waiting status, respondToValidation resolves it", async () => {
      const validation = await addValidation("ticket", ticketId, { validatorKind: "user", validatorId: otherUser.id, comment: "Please review" });
      expect(validation.status).toBe("waiting");
      expect(validation.respondedAt).toBeNull();

      const listed = await listValidations("ticket", ticketId);
      expect(listed.map((v) => v.id)).toContain(validation.id);

      const responded = await respondToValidation(validation.id, "approved", "Looks good");
      expect(responded.status).toBe("approved");
      expect(responded.comment).toBe("Looks good");
      expect(responded.respondedAt).toBeInstanceOf(Date);
    });

    it("throws when responding to a nonexistent validation", async () => {
      await expect(respondToValidation("00000000-0000-0000-0000-000000000000", "approved")).rejects.toThrow();
    });
  });

  describe("costs", () => {
    it("addCost/listCosts round-trip without a budget", async () => {
      const cost = await addCost("ticket", ticketId, { costType: "labor", amountCents: 15_000, comment: "2 horas de tecnico" });
      expect(cost.budgetId).toBeNull();

      const costs = await listCosts("ticket", ticketId);
      expect(costs.map((c) => c.id)).toContain(cost.id);
    });
  });
});
