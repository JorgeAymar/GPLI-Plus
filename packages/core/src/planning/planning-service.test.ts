import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  assetDefinitions,
  assets,
  changes,
  db,
  projects,
  reservationItems,
  reservations,
  type Entity,
  type User,
} from "@itsm/db";
import { createTestEntity, createTestUser, deleteTestEntities, deleteTestUsers } from "../__vitest_tools__/fixtures";
import { getPlanningItems } from "./planning-service";

describe("planning-service", () => {
  let entity: Entity;
  let requester: User;
  let assetDefinitionId: string;

  const entityIds: string[] = [];
  const userIds: string[] = [];
  const changeIds: string[] = [];
  const projectIds: string[] = [];
  const assetIds: string[] = [];
  const reservationItemIds: string[] = [];
  const reservationIds: string[] = [];

  const windowFrom = new Date("2027-01-01T00:00:00Z");
  const windowTo = new Date("2027-01-31T23:59:59Z");

  beforeAll(async () => {
    entity = await createTestEntity();
    entityIds.push(entity.id);
    requester = await createTestUser();
    userIds.push(requester.id);

    const [existingDefinition] = await db.select().from(assetDefinitions).limit(1);
    if (!existingDefinition) throw new Error("Expected at least one seeded asset definition");
    assetDefinitionId = existingDefinition.id;
  });

  afterAll(async () => {
    for (const id of reservationIds) {
      await db.delete(reservations).where(eq(reservations.id, id));
    }
    for (const id of reservationItemIds) {
      await db.delete(reservationItems).where(eq(reservationItems.id, id));
    }
    for (const id of assetIds) {
      await db.delete(assets).where(eq(assets.id, id));
    }
    for (const id of projectIds) {
      await db.delete(projects).where(eq(projects.id, id));
    }
    for (const id of changeIds) {
      await db.delete(changes).where(eq(changes.id, id));
    }
    await deleteTestUsers(userIds);
    await deleteTestEntities(entityIds);
  });

  it("returns changes, projects, and reservations that overlap the [from, to] window, and excludes items outside it", async () => {
    // In-window change.
    const [inWindowChange] = await db
      .insert(changes)
      .values({
        entityId: entity.id,
        title: "__vitest_tools__ change in window",
        content: "content",
        plannedStartAt: new Date("2027-01-10T09:00:00Z"),
        plannedEndAt: new Date("2027-01-10T11:00:00Z"),
      })
      .returning();
    changeIds.push(inWindowChange!.id);

    // Out-of-window change (entirely before the window).
    const [outOfWindowChange] = await db
      .insert(changes)
      .values({
        entityId: entity.id,
        title: "__vitest_tools__ change out of window",
        content: "content",
        plannedStartAt: new Date("2026-11-01T09:00:00Z"),
        plannedEndAt: new Date("2026-11-01T11:00:00Z"),
      })
      .returning();
    changeIds.push(outOfWindowChange!.id);

    // Change with no plannedStartAt at all - never "planned", must be excluded outright.
    const [unplannedChange] = await db
      .insert(changes)
      .values({ entityId: entity.id, title: "__vitest_tools__ unplanned change", content: "content" })
      .returning();
    changeIds.push(unplannedChange!.id);

    // In-window project.
    const [inWindowProject] = await db
      .insert(projects)
      .values({
        entityId: entity.id,
        name: "__vitest_tools__ project in window",
        planStartAt: new Date("2027-01-15T00:00:00Z"),
        planEndAt: new Date("2027-01-20T00:00:00Z"),
      })
      .returning();
    projectIds.push(inWindowProject!.id);

    // Out-of-window project (entirely after the window).
    const [outOfWindowProject] = await db
      .insert(projects)
      .values({
        entityId: entity.id,
        name: "__vitest_tools__ project out of window",
        planStartAt: new Date("2027-03-01T00:00:00Z"),
        planEndAt: new Date("2027-03-05T00:00:00Z"),
      })
      .returning();
    projectIds.push(outOfWindowProject!.id);

    // In-window reservation.
    const [asset] = await db
      .insert(assets)
      .values({ entityId: entity.id, assetDefinitionId, name: "__vitest_tools__ planning asset" })
      .returning();
    assetIds.push(asset!.id);
    const [reservationItem] = await db.insert(reservationItems).values({ assetId: asset!.id }).returning();
    reservationItemIds.push(reservationItem!.id);
    const [inWindowReservation] = await db
      .insert(reservations)
      .values({
        reservationItemId: reservationItem!.id,
        beginAt: new Date("2027-01-05T09:00:00Z"),
        endAt: new Date("2027-01-05T10:00:00Z"),
        requestedByUserId: requester.id,
      })
      .returning();
    reservationIds.push(inWindowReservation!.id);

    // Out-of-window reservation.
    const [outOfWindowReservation] = await db
      .insert(reservations)
      .values({
        reservationItemId: reservationItem!.id,
        beginAt: new Date("2027-02-10T09:00:00Z"),
        endAt: new Date("2027-02-10T10:00:00Z"),
        requestedByUserId: requester.id,
      })
      .returning();
    reservationIds.push(outOfWindowReservation!.id);

    const items = await getPlanningItems(entity.id, { from: windowFrom, to: windowTo });
    const ids = items.map((i) => i.itemId);

    expect(ids).toContain(inWindowChange!.id);
    expect(ids).toContain(inWindowProject!.id);
    expect(ids).toContain(inWindowReservation!.id);

    expect(ids).not.toContain(outOfWindowChange!.id);
    expect(ids).not.toContain(unplannedChange!.id);
    expect(ids).not.toContain(outOfWindowProject!.id);
    expect(ids).not.toContain(outOfWindowReservation!.id);

    const itemTypes = new Set(items.filter((i) => ids.includes(i.itemId)).map((i) => i.itemType));
    expect(itemTypes.has("change")).toBe(true);
    expect(itemTypes.has("project")).toBe(true);
    expect(itemTypes.has("reservation")).toBe(true);

    // Sorted by startAt ascending.
    const startTimes = items.map((i) => i.startAt.getTime());
    expect([...startTimes].sort((a, b) => a - b)).toEqual(startTimes);
  });

  it("includes a change with a plannedStartAt but no plannedEndAt, treating it as a point-in-time event", async () => {
    const [pointInTimeChange] = await db
      .insert(changes)
      .values({
        entityId: entity.id,
        title: "__vitest_tools__ point in time change",
        content: "content",
        plannedStartAt: new Date("2027-01-12T09:00:00Z"),
        plannedEndAt: null,
      })
      .returning();
    changeIds.push(pointInTimeChange!.id);

    const items = await getPlanningItems(entity.id, { from: windowFrom, to: windowTo });
    const found = items.find((i) => i.itemId === pointInTimeChange!.id);
    expect(found).toBeDefined();
    expect(found?.endAt.getTime()).toBe(found?.startAt.getTime());
  });
});
