import { auditLog, db, entities, itilActors, problems, users, type Entity, type User } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createUser } from "../users/user-service";
import { listActors } from "./itil-shared-service";
import { createProblem, getProblem, listProblems, updateProblem, updateProblemStatus } from "./problem-service";

const PREFIX = "__vitest_itil__problem_service";

let parentEntity: Entity;
let childEntity: Entity;
let requester: User;
const problemIds: string[] = [];

beforeAll(async () => {
  parentEntity = await createEntity({ name: `${PREFIX}_parent_${Date.now()}` });
  childEntity = await createEntity({ name: `${PREFIX}_child_${Date.now()}`, parentId: parentEntity.id });
  requester = await createUser({
    email: `${PREFIX}_${Date.now()}@example.test`,
    username: `${PREFIX}_${Date.now()}`,
    password: "not-used-in-tests",
    displayName: `${PREFIX} requester`,
  });
});

afterAll(async () => {
  if (problemIds.length > 0) {
    await db.delete(itilActors).where(inArray(itilActors.itilId, problemIds));
  }
  await db.delete(auditLog).where(inArray(auditLog.entityId, [parentEntity.id, childEntity.id]));
  if (problemIds.length > 0) {
    await db.delete(problems).where(inArray(problems.id, problemIds));
  }
  await db.delete(entities).where(eq(entities.id, childEntity.id));
  await db.delete(entities).where(eq(entities.id, parentEntity.id));
  await db.delete(users).where(eq(users.id, requester.id));
});

describe("problem-service", () => {
  it("creates a problem with defaults and auto-adds the creator as the requester actor", async () => {
    const problem = await createProblem({ entityId: parentEntity.id, title: "Cortes intermitentes", content: "content" }, requester.id);
    problemIds.push(problem.id);

    expect(problem.status).toBe("new");
    expect(problem.urgency).toBe(3);

    const actors = await listActors("problem", problem.id);
    expect(actors).toHaveLength(1);
    expect(actors[0]).toMatchObject({ actorRole: "requester", actorKind: "user", actorId: requester.id });

    const rows = await db.select().from(auditLog).where(eq(auditLog.objectId, problem.id));
    expect(rows.some((r) => r.action === "create" && r.objectType === "problem")).toBe(true);
  });

  it("getProblem / listProblems round-trip, including status filter and subtree visibility", async () => {
    const inChild = await createProblem({ entityId: childEntity.id, title: "In child entity", content: "content" }, requester.id);
    problemIds.push(inChild.id);

    const fetched = await getProblem(inChild.id);
    expect(fetched?.id).toBe(inChild.id);

    const fromChild = await listProblems(childEntity.id);
    expect(fromChild.map((p) => p.id)).toContain(inChild.id);

    const fromParentDirect = await listProblems(parentEntity.id);
    expect(fromParentDirect.map((p) => p.id)).not.toContain(inChild.id);

    const fromParentSubtree = await listProblems(parentEntity.id, { includeSubtree: true });
    expect(fromParentSubtree.map((p) => p.id)).toContain(inChild.id);

    const solvedOnly = await listProblems(childEntity.id, { status: "solved" });
    expect(solvedOnly.map((p) => p.id)).not.toContain(inChild.id);
  });

  it("updateProblem updates fields and records an audit entry", async () => {
    const problem = await createProblem({ entityId: parentEntity.id, title: "Before", content: "content" }, requester.id);
    problemIds.push(problem.id);

    const updated = await updateProblem(problem.id, { title: "After" }, requester.id);
    expect(updated.title).toBe("After");

    const rows = await db.select().from(auditLog).where(eq(auditLog.objectId, problem.id));
    expect(rows.some((r) => r.action === "update")).toBe(true);
  });

  it("updateProblemStatus stamps solvedAt/closedAt and records status_change entries", async () => {
    const problem = await createProblem({ entityId: parentEntity.id, title: "Lifecycle", content: "content" }, requester.id);
    problemIds.push(problem.id);

    const solved = await updateProblemStatus(problem.id, "solved", requester.id);
    expect(solved.solvedAt).toBeInstanceOf(Date);
    expect(solved.closedAt).toBeNull();

    const closed = await updateProblemStatus(problem.id, "closed", requester.id);
    expect(closed.closedAt).toBeInstanceOf(Date);

    const rows = await db.select().from(auditLog).where(eq(auditLog.objectId, problem.id));
    expect(rows.filter((r) => r.action === "status_change")).toHaveLength(2);
  });

  it("throws when updating a nonexistent problem", async () => {
    await expect(updateProblem("00000000-0000-0000-0000-000000000000", { title: "x" }, requester.id)).rejects.toThrow();
  });
});
