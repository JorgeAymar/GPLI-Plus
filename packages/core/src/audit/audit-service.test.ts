import "dotenv/config";
import { randomUUID } from "node:crypto";
import { auditLog, db, entities, users } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createUser } from "../users/user-service";
import { countAuditLog, listAuditLog, recordAuditLog } from "./audit-service";

const PREFIX = "__vitest_platform__";
// A one-off objectType nobody else in the test suite (or the app) uses, so filtering by it is
// immune to whatever other audit_log rows concurrent tests/processes are writing at the same time.
const OBJECT_TYPE = `${PREFIX}audit_object_${randomUUID()}`;

describe("audit-service", () => {
  let entityId: string;
  let userA: string;
  let userB: string;
  const objectIds: string[] = [];

  const day1 = new Date("2024-01-01T00:00:00.000Z");
  const day2 = new Date("2024-01-15T00:00:00.000Z");
  const day3 = new Date("2024-02-01T00:00:00.000Z");

  beforeAll(async () => {
    const entity = await createEntity({ name: `${PREFIX}audit_entity_${randomUUID()}` });
    entityId = entity.id;

    const a = await createUser({
      email: `${PREFIX}audit_a_${randomUUID()}@example.com`,
      username: `${PREFIX}audit_a_${randomUUID()}`,
      password: "correct-horse-battery-staple",
      displayName: "Audit Test User A",
    });
    userA = a.id;

    const b = await createUser({
      email: `${PREFIX}audit_b_${randomUUID()}@example.com`,
      username: `${PREFIX}audit_b_${randomUUID()}`,
      password: "correct-horse-battery-staple",
      displayName: "Audit Test User B",
    });
    userB = b.id;

    const rows = [
      { actorUserId: userA, createdAt: day1 },
      { actorUserId: userB, createdAt: day2 },
      { actorUserId: userA, createdAt: day3 },
    ];
    for (const row of rows) {
      const objectId = randomUUID();
      objectIds.push(objectId);
      await db.insert(auditLog).values({
        entityId,
        actorUserId: row.actorUserId,
        action: "create",
        objectType: OBJECT_TYPE,
        objectId,
        createdAt: row.createdAt,
      });
    }
  });

  afterAll(async () => {
    await db.delete(auditLog).where(eq(auditLog.entityId, entityId));
    await db.delete(users).where(inArray(users.id, [userA, userB]));
    await db.delete(entities).where(eq(entities.id, entityId));
  });

  it("listAuditLog with only the objectType filter returns every matching row, newest first", async () => {
    const rows = await listAuditLog({ objectType: OBJECT_TYPE }, { limit: 10, offset: 0 });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.objectId)).toEqual([objectIds[2], objectIds[1], objectIds[0]]);
  });

  it("listAuditLog filters by actorUserId", async () => {
    const rows = await listAuditLog({ objectType: OBJECT_TYPE, actorUserId: userA }, { limit: 10, offset: 0 });
    expect(rows.map((r) => r.objectId).sort()).toEqual([objectIds[0], objectIds[2]].sort());
  });

  it("listAuditLog filters by date range (from/to)", async () => {
    const rows = await listAuditLog(
      { objectType: OBJECT_TYPE, from: new Date("2024-01-10T00:00:00.000Z"), to: new Date("2024-01-20T00:00:00.000Z") },
      { limit: 10, offset: 0 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.objectId).toBe(objectIds[1]);
  });

  it("listAuditLog paginates with limit/offset", async () => {
    const page = await listAuditLog({ objectType: OBJECT_TYPE }, { limit: 1, offset: 1 });
    expect(page).toHaveLength(1);
    expect(page[0]?.objectId).toBe(objectIds[1]);
  });

  it("countAuditLog matches the same filters used by listAuditLog", async () => {
    expect(await countAuditLog({ objectType: OBJECT_TYPE })).toBe(3);
    expect(await countAuditLog({ objectType: OBJECT_TYPE, actorUserId: userA })).toBe(2);
    expect(
      await countAuditLog({
        objectType: OBJECT_TYPE,
        from: new Date("2024-01-10T00:00:00.000Z"),
        to: new Date("2024-01-20T00:00:00.000Z"),
      }),
    ).toBe(1);
  });

  it("listAuditLog/countAuditLog with no filters at all still work (global browse)", async () => {
    // Not asserting exact counts (other rows exist system-wide) - just that the unfiltered path doesn't throw
    // and that our own rows are included in a large-enough page.
    const rows = await listAuditLog({}, { limit: 5, offset: 0 });
    expect(Array.isArray(rows)).toBe(true);
    const total = await countAuditLog({});
    expect(total).toBeGreaterThanOrEqual(3);
  });

  it("recordAuditLog persists before/after JSON and is visible through listAuditLog", async () => {
    const objectId = randomUUID();
    await recordAuditLog({
      entityId,
      actorUserId: userA,
      action: "update",
      objectType: `${OBJECT_TYPE}_record`,
      objectId,
      before: { status: "old" },
      after: { status: "new" },
    });

    const rows = await listAuditLog({ objectType: `${OBJECT_TYPE}_record` }, { limit: 10, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.before).toEqual({ status: "old" });
    expect(rows[0]?.after).toEqual({ status: "new" });
    expect(rows[0]?.action).toBe("update");
  });
});
