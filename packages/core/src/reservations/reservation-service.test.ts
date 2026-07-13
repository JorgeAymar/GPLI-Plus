import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { assetDefinitions, assets, db, reservationItems, reservations, type Entity, type User } from "@itsm/db";
import { createTestEntity, createTestUser, deleteTestEntities, deleteTestUsers } from "../__vitest_tools__/fixtures";
import {
  cancelReservation,
  createRecurringReservations,
  createReservation,
  createReservationItem,
  getReservationItem,
  listReservationItems,
  listReservationsForItem,
} from "./reservation-service";

describe("reservation-service", () => {
  let entity: Entity;
  let requester: User;
  let assetDefinitionId: string;

  const entityIds: string[] = [];
  const userIds: string[] = [];
  const assetIds: string[] = [];
  const reservationItemIds: string[] = [];

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
    for (const itemId of reservationItemIds) {
      await db.delete(reservations).where(eq(reservations.reservationItemId, itemId));
    }
    for (const itemId of reservationItemIds) {
      await db.delete(reservationItems).where(eq(reservationItems.id, itemId));
    }
    for (const assetId of assetIds) {
      await db.delete(assets).where(eq(assets.id, assetId));
    }
    await deleteTestUsers(userIds);
    await deleteTestEntities(entityIds);
  });

  async function createTestAsset(): Promise<string> {
    const [created] = await db
      .insert(assets)
      .values({ entityId: entity.id, assetDefinitionId, name: `__vitest_tools__ asset ${crypto.randomUUID().slice(0, 8)}` })
      .returning();
    if (!created) throw new Error("Failed to insert test asset");
    assetIds.push(created.id);
    return created.id;
  }

  it("createReservationItem + getReservationItem roundtrip, and listReservationItems scopes by entity", async () => {
    const assetId = await createTestAsset();
    const item = await createReservationItem({ assetId });
    reservationItemIds.push(item.id);

    const fetched = await getReservationItem(item.id);
    expect(fetched?.id).toBe(item.id);

    const listed = await listReservationItems(entity.id);
    expect(listed.map((row) => row.item.id)).toContain(item.id);
    expect(listed.find((row) => row.item.id === item.id)?.asset.id).toBe(assetId);
  });

  it("createReservation succeeds for a free date range", async () => {
    const assetId = await createTestAsset();
    const item = await createReservationItem({ assetId });
    reservationItemIds.push(item.id);

    const beginAt = new Date("2027-01-10T09:00:00Z");
    const endAt = new Date("2027-01-10T11:00:00Z");

    const reservation = await createReservation({ reservationItemId: item.id, beginAt, endAt, requestedByUserId: requester.id });
    expect(reservation.reservationItemId).toBe(item.id);

    const list = await listReservationsForItem(item.id);
    expect(list.map((r) => r.id)).toContain(reservation.id);
  });

  it("rejects a second reservation of the same asset when the date range overlaps an existing one", async () => {
    const assetId = await createTestAsset();
    const item = await createReservationItem({ assetId });
    reservationItemIds.push(item.id);

    await createReservation({
      reservationItemId: item.id,
      beginAt: new Date("2027-02-01T09:00:00Z"),
      endAt: new Date("2027-02-01T12:00:00Z"),
      requestedByUserId: requester.id,
    });

    // Fully overlapping
    await expect(
      createReservation({
        reservationItemId: item.id,
        beginAt: new Date("2027-02-01T10:00:00Z"),
        endAt: new Date("2027-02-01T11:00:00Z"),
        requestedByUserId: requester.id,
      }),
    ).rejects.toThrow(/Conflicto de horario/);

    // Partially overlapping (starts before, ends inside)
    await expect(
      createReservation({
        reservationItemId: item.id,
        beginAt: new Date("2027-02-01T08:00:00Z"),
        endAt: new Date("2027-02-01T09:30:00Z"),
        requestedByUserId: requester.id,
      }),
    ).rejects.toThrow(/Conflicto de horario/);
  });

  it("allows a back-to-back reservation that starts exactly when the previous one ends (half-open range)", async () => {
    const assetId = await createTestAsset();
    const item = await createReservationItem({ assetId });
    reservationItemIds.push(item.id);

    await createReservation({
      reservationItemId: item.id,
      beginAt: new Date("2027-03-01T09:00:00Z"),
      endAt: new Date("2027-03-01T10:00:00Z"),
      requestedByUserId: requester.id,
    });

    const backToBack = await createReservation({
      reservationItemId: item.id,
      beginAt: new Date("2027-03-01T10:00:00Z"),
      endAt: new Date("2027-03-01T11:00:00Z"),
      requestedByUserId: requester.id,
    });

    expect(backToBack.reservationItemId).toBe(item.id);
  });

  it("does not block reservations of a different asset for the same date range", async () => {
    const assetIdA = await createTestAsset();
    const assetIdB = await createTestAsset();
    const itemA = await createReservationItem({ assetId: assetIdA });
    const itemB = await createReservationItem({ assetId: assetIdB });
    reservationItemIds.push(itemA.id, itemB.id);

    const beginAt = new Date("2027-04-01T09:00:00Z");
    const endAt = new Date("2027-04-01T10:00:00Z");

    await createReservation({ reservationItemId: itemA.id, beginAt, endAt, requestedByUserId: requester.id });
    const reservationB = await createReservation({ reservationItemId: itemB.id, beginAt, endAt, requestedByUserId: requester.id });

    expect(reservationB.reservationItemId).toBe(itemB.id);
  });

  it("createRecurringReservations creates the non-conflicting dates and reports the conflicting ones as skipped", async () => {
    const assetId = await createTestAsset();
    const item = await createReservationItem({ assetId });
    reservationItemIds.push(item.id);

    // Pre-existing reservation that should collide with one of the recurring dates.
    await createReservation({
      reservationItemId: item.id,
      beginAt: new Date("2027-05-03T09:00:00Z"),
      endAt: new Date("2027-05-03T10:00:00Z"),
      requestedByUserId: requester.id,
    });

    const result = await createRecurringReservations({
      reservationItemId: item.id,
      requestedByUserId: requester.id,
      dates: [
        { beginAt: new Date("2027-05-01T09:00:00Z"), endAt: new Date("2027-05-01T10:00:00Z") },
        { beginAt: new Date("2027-05-03T09:30:00Z"), endAt: new Date("2027-05-03T10:30:00Z") }, // overlaps pre-existing
        { beginAt: new Date("2027-05-05T09:00:00Z"), endAt: new Date("2027-05-05T10:00:00Z") },
      ],
    });

    expect(result.created).toHaveLength(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toMatch(/Conflicto de horario/);

    const seriesGroupIds = new Set(result.created.map((r) => r.seriesGroupId));
    expect(seriesGroupIds.size).toBe(1);
  });

  it("cancelReservation removes the reservation", async () => {
    const assetId = await createTestAsset();
    const item = await createReservationItem({ assetId });
    reservationItemIds.push(item.id);

    const reservation = await createReservation({
      reservationItemId: item.id,
      beginAt: new Date("2027-06-01T09:00:00Z"),
      endAt: new Date("2027-06-01T10:00:00Z"),
      requestedByUserId: requester.id,
    });

    await cancelReservation(reservation.id);

    const list = await listReservationsForItem(item.id);
    expect(list.map((r) => r.id)).not.toContain(reservation.id);
  });
});
