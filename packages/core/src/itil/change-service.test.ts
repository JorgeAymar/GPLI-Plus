import { auditLog, changes, db, entities, itilActors, users, type Entity, type User } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createUser } from "../users/user-service";
import { addActor, listActors } from "./itil-shared-service";
import { createChange, getChange, listChanges, updateChange, updateChangeStatus } from "./change-service";

const PREFIX = "__vitest_itil__change_service";

let entity: Entity;
let requester: User;
let assignee: User;
const changeIds: string[] = [];

beforeAll(async () => {
  entity = await createEntity({ name: `${PREFIX}_entity_${Date.now()}` });
  requester = await createUser({
    email: `${PREFIX}_requester_${Date.now()}@example.test`,
    username: `${PREFIX}_requester_${Date.now()}`,
    password: "not-used-in-tests",
    displayName: `${PREFIX} requester`,
  });
  assignee = await createUser({
    email: `${PREFIX}_assignee_${Date.now()}@example.test`,
    username: `${PREFIX}_assignee_${Date.now()}`,
    password: "not-used-in-tests",
    displayName: `${PREFIX} assignee`,
  });
});

afterAll(async () => {
  if (changeIds.length > 0) {
    await db.delete(itilActors).where(inArray(itilActors.itilId, changeIds));
  }
  await db.delete(auditLog).where(eq(auditLog.entityId, entity.id));
  if (changeIds.length > 0) {
    await db.delete(changes).where(inArray(changes.id, changeIds));
  }
  await db.delete(entities).where(eq(entities.id, entity.id));
  await db.delete(users).where(inArray(users.id, [requester.id, assignee.id]));
});

describe("change-service", () => {
  it("creates a change with planned dates, defaults, and the creator as requester actor", async () => {
    const plannedStartAt = new Date("2026-08-01T10:00:00.000Z");
    const plannedEndAt = new Date("2026-08-01T12:00:00.000Z");

    const change = await createChange(
      { entityId: entity.id, title: "Migración de servidor", content: "content", plannedStartAt, plannedEndAt },
      requester.id,
    );
    changeIds.push(change.id);

    expect(change.status).toBe("new");
    expect(change.plannedStartAt).toEqual(plannedStartAt);
    expect(change.plannedEndAt).toEqual(plannedEndAt);

    const actors = await listActors("change", change.id);
    expect(actors).toHaveLength(1);
    expect(actors[0]).toMatchObject({ actorRole: "requester", actorKind: "user", actorId: requester.id });

    const rows = await db.select().from(auditLog).where(eq(auditLog.objectId, change.id));
    expect(rows.some((r) => r.action === "create" && r.objectType === "change")).toBe(true);
  });

  it("a Change with actors assigned exposes both requester and assignee via listActors", async () => {
    const change = await createChange({ entityId: entity.id, title: "Con actores", content: "content" }, requester.id);
    changeIds.push(change.id);

    await addActor("change", change.id, { actorRole: "assignee", actorKind: "user", actorId: assignee.id });

    const actors = await listActors("change", change.id);
    expect(actors).toHaveLength(2);
    expect(actors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actorRole: "requester", actorId: requester.id }),
        expect.objectContaining({ actorRole: "assignee", actorId: assignee.id }),
      ]),
    );
  });

  it("getChange / listChanges round-trip and status filter", async () => {
    const change = await createChange({ entityId: entity.id, title: "Round trip", content: "content" }, requester.id);
    changeIds.push(change.id);

    const fetched = await getChange(change.id);
    expect(fetched?.id).toBe(change.id);

    const listed = await listChanges(entity.id, { status: "new" });
    expect(listed.map((c) => c.id)).toContain(change.id);

    const solvedOnly = await listChanges(entity.id, { status: "solved" });
    expect(solvedOnly.map((c) => c.id)).not.toContain(change.id);
  });

  it("updateChange updates fields and updateChangeStatus stamps solvedAt/closedAt", async () => {
    const change = await createChange({ entityId: entity.id, title: "Before", content: "content" }, requester.id);
    changeIds.push(change.id);

    const updated = await updateChange(change.id, { title: "After" }, requester.id);
    expect(updated.title).toBe("After");

    const solved = await updateChangeStatus(change.id, "solved", requester.id);
    expect(solved.solvedAt).toBeInstanceOf(Date);

    const closed = await updateChangeStatus(change.id, "closed", requester.id);
    expect(closed.closedAt).toBeInstanceOf(Date);

    const rows = await db.select().from(auditLog).where(eq(auditLog.objectId, change.id));
    expect(rows.some((r) => r.action === "update")).toBe(true);
    expect(rows.filter((r) => r.action === "status_change")).toHaveLength(2);
  });
});
