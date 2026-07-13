import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  assetDefinitions,
  assets,
  contracts,
  db,
  dropdownCategories,
  dropdownItems,
  itilSlaAssignments,
  reservationItems,
  reservations,
  slaPolicies,
  tickets,
  type Entity,
  type ItilStatus,
  type User,
} from "@itsm/db";
import { createTestEntity, createTestUser, deleteTestEntities, deleteTestUsers } from "../__vitest_tools__/fixtures";
import {
  getAssetCountsByStatus,
  getAssetCountsByType,
  getContractsExpiringReport,
  getReservationUsageReport,
  getSlaComplianceRate,
  getTicketCountsByStatus,
  getTicketsCreatedByDay,
  getYearlyAssetsReport,
} from "./report-service";

describe("report-service", () => {
  let entity: Entity;
  let requester: User;
  let assetDefinitionId: string;
  let statusCategoryId: string;

  const entityIds: string[] = [];
  const userIds: string[] = [];
  const assetIds: string[] = [];
  const dropdownItemIds: string[] = [];
  const contractIds: string[] = [];
  const ticketIds: string[] = [];
  const slaPolicyIds: string[] = [];
  const slaAssignmentIds: string[] = [];
  const reservationItemIds: string[] = [];
  const reservationIds: string[] = [];

  beforeAll(async () => {
    entity = await createTestEntity();
    entityIds.push(entity.id);
    requester = await createTestUser();
    userIds.push(requester.id);

    const [existingDefinition] = await db.select().from(assetDefinitions).limit(1);
    if (!existingDefinition) throw new Error("Expected at least one seeded asset definition");
    assetDefinitionId = existingDefinition.id;

    const [existingStatusCategory] = await db.select().from(dropdownCategories).where(eq(dropdownCategories.key, "status"));
    if (!existingStatusCategory) throw new Error("Expected a seeded 'status' dropdown category");
    statusCategoryId = existingStatusCategory.id;
  });

  afterAll(async () => {
    for (const id of slaAssignmentIds) {
      await db.delete(itilSlaAssignments).where(eq(itilSlaAssignments.id, id));
    }
    for (const id of slaPolicyIds) {
      await db.delete(slaPolicies).where(eq(slaPolicies.id, id));
    }
    for (const id of ticketIds) {
      await db.delete(tickets).where(eq(tickets.id, id));
    }
    for (const id of reservationIds) {
      await db.delete(reservations).where(eq(reservations.id, id));
    }
    for (const id of reservationItemIds) {
      await db.delete(reservationItems).where(eq(reservationItems.id, id));
    }
    for (const id of contractIds) {
      await db.delete(contracts).where(eq(contracts.id, id));
    }
    for (const id of assetIds) {
      await db.delete(assets).where(eq(assets.id, id));
    }
    for (const id of dropdownItemIds) {
      await db.delete(dropdownItems).where(eq(dropdownItems.id, id));
    }
    await deleteTestUsers(userIds);
    await deleteTestEntities(entityIds);
  });

  async function createTestAsset(overrides?: Partial<{ statusDropdownItemId: string | null }>): Promise<string> {
    const [created] = await db
      .insert(assets)
      .values({
        entityId: entity.id,
        assetDefinitionId,
        name: `__vitest_tools__ asset ${crypto.randomUUID().slice(0, 8)}`,
        statusDropdownItemId: overrides?.statusDropdownItemId ?? null,
      })
      .returning();
    if (!created) throw new Error("Failed to insert test asset");
    assetIds.push(created.id);
    return created.id;
  }

  async function createTestStatusDropdownItem(): Promise<string> {
    const [created] = await db
      .insert(dropdownItems)
      .values({
        categoryId: statusCategoryId,
        entityId: entity.id,
        name: `__vitest_tools__ status ${crypto.randomUUID().slice(0, 8)}`,
      })
      .returning();
    if (!created) throw new Error("Failed to insert test dropdown item");
    dropdownItemIds.push(created.id);
    return created.id;
  }

  async function createTestTicket(overrides?: Partial<{ createdAt: Date; status: ItilStatus }>): Promise<string> {
    const [created] = await db
      .insert(tickets)
      .values({
        entityId: entity.id,
        title: "__vitest_tools__ ticket",
        content: "content",
        status: overrides?.status ?? "new",
      })
      .returning();
    if (!created) throw new Error("Failed to insert test ticket");
    if (overrides?.createdAt) {
      await db.update(tickets).set({ createdAt: overrides.createdAt }).where(eq(tickets.id, created.id));
    }
    ticketIds.push(created.id);
    return created.id;
  }

  it("getAssetCountsByStatus groups active assets by status, using 'Sin estado' for assets with none", async () => {
    const inUseStatusId = await createTestStatusDropdownItem();

    await createTestAsset({ statusDropdownItemId: inUseStatusId });
    await createTestAsset({ statusDropdownItemId: inUseStatusId });
    await createTestAsset({ statusDropdownItemId: null });

    const report = await getAssetCountsByStatus(entity.id);
    const withStatus = report.find((r) => r.statusDropdownItemId === inUseStatusId);
    const withoutStatus = report.find((r) => r.statusDropdownItemId === null);

    expect(withStatus?.count).toBe(2);
    expect(withoutStatus?.count).toBeGreaterThanOrEqual(1);
    expect(withoutStatus?.name).toBe("Sin estado");
  });

  it("getAssetCountsByStatus excludes soft-deleted assets", async () => {
    const statusId = await createTestStatusDropdownItem();
    const keptAssetId = await createTestAsset({ statusDropdownItemId: statusId });
    const deletedAssetId = await createTestAsset({ statusDropdownItemId: statusId });
    await db.update(assets).set({ deletedAt: new Date() }).where(eq(assets.id, deletedAssetId));

    const report = await getAssetCountsByStatus(entity.id);
    const row = report.find((r) => r.statusDropdownItemId === statusId);
    // Only the non-deleted asset should be counted for this status.
    expect(row?.count).toBe(1);
    void keptAssetId;
  });

  it("getAssetCountsByType groups active assets by asset definition", async () => {
    await createTestAsset();
    await createTestAsset();

    const report = await getAssetCountsByType(entity.id);
    const row = report.find((r) => r.assetDefinitionId === assetDefinitionId);
    expect(row).toBeDefined();
    expect(row!.count).toBeGreaterThanOrEqual(2);
  });

  it("getContractsExpiringReport returns only contracts whose endDate falls within the window", async () => {
    const now = Date.now();
    const soon = new Date(now + 5 * 86_400_000);
    const tooLate = new Date(now + 90 * 86_400_000);
    const alreadyPast = new Date(now - 5 * 86_400_000);

    const [expiringSoon] = await db
      .insert(contracts)
      .values({ entityId: entity.id, name: "__vitest_tools__ contract soon", endDate: soon })
      .returning();
    const [expiringLate] = await db
      .insert(contracts)
      .values({ entityId: entity.id, name: "__vitest_tools__ contract late", endDate: tooLate })
      .returning();
    const [expiringPast] = await db
      .insert(contracts)
      .values({ entityId: entity.id, name: "__vitest_tools__ contract past", endDate: alreadyPast })
      .returning();
    contractIds.push(expiringSoon!.id, expiringLate!.id, expiringPast!.id);

    const report = await getContractsExpiringReport(entity.id, 30);
    const ids = report.map((c) => c.id);
    expect(ids).toContain(expiringSoon!.id);
    expect(ids).not.toContain(expiringLate!.id);
    expect(ids).not.toContain(expiringPast!.id);
  });

  it("getYearlyAssetsReport buckets active assets by the year of createdAt", async () => {
    const assetId = await createTestAsset();
    await db.update(assets).set({ createdAt: new Date("2020-06-15T00:00:00Z") }).where(eq(assets.id, assetId));

    const report = await getYearlyAssetsReport(entity.id);
    const row2020 = report.find((r) => r.year === 2020);
    expect(row2020?.count).toBeGreaterThanOrEqual(1);
  });

  it("getTicketCountsByStatus groups tickets by ITIL status", async () => {
    await createTestTicket({ status: "new" });
    await createTestTicket({ status: "closed" });
    await createTestTicket({ status: "closed" });

    const report = await getTicketCountsByStatus(entity.id);
    const closedRow = report.find((r) => r.status === "closed");
    const newRow = report.find((r) => r.status === "new");
    expect(closedRow?.count).toBeGreaterThanOrEqual(2);
    expect(newRow?.count).toBeGreaterThanOrEqual(1);
  });

  it("getTicketsCreatedByDay fills every day of the window, including zero-ticket days", async () => {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);

    await createTestTicket({ createdAt: today });

    const report = await getTicketsCreatedByDay(entity.id, { days: 7 });
    expect(report).toHaveLength(7);
    const todayRow = report.find((r) => r.date === todayKey);
    expect(todayRow?.count).toBeGreaterThanOrEqual(1);

    // Every entry present, sorted ascending by date.
    const dates = report.map((r) => r.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("getTicketsCreatedByDay excludes tickets created before the window", async () => {
    const longAgo = new Date(Date.now() - 60 * 86_400_000);
    await createTestTicket({ createdAt: longAgo });

    const report = await getTicketsCreatedByDay(entity.id, { days: 7 });
    const longAgoKey = longAgo.toISOString().slice(0, 10);
    expect(report.some((r) => r.date === longAgoKey)).toBe(false);
  });

  it("getSlaComplianceRate returns 100% compliance (vacuously) when there are zero assignments in the window", async () => {
    // Fresh entity so this suite's other SLA-assignment tests never leak into the zero-total case.
    const isolatedEntity = await createTestEntity();
    entityIds.push(isolatedEntity.id);

    const report = await getSlaComplianceRate(isolatedEntity.id, { days: 7 });
    expect(report.total).toBe(0);
    expect(report.breached).toBe(0);
    expect(report.complianceRate).toBe(1);
  });

  it("getSlaComplianceRate computes the compliance rate from breached vs total ticket SLA assignments", async () => {
    const ticketId = await createTestTicket();
    const [policy] = await db
      .insert(slaPolicies)
      .values({ entityId: entity.id, name: "__vitest_tools__ sla policy", ttrMinutes: 60 })
      .returning();
    if (!policy) throw new Error("Failed to insert test SLA policy");
    slaPolicyIds.push(policy.id);

    const now = new Date();
    const [breachedRows, compliantRows] = await Promise.all([
      db
        .insert(itilSlaAssignments)
        .values({ itilType: "ticket", itilId: ticketId, slaPolicyId: policy.id, slaType: "ttr", dueAt: now, isBreached: true })
        .returning(),
      db
        .insert(itilSlaAssignments)
        .values({ itilType: "ticket", itilId: ticketId, slaPolicyId: policy.id, slaType: "tto", dueAt: now, isBreached: false })
        .returning(),
    ]);
    slaAssignmentIds.push(breachedRows[0]!.id, compliantRows[0]!.id);

    const report = await getSlaComplianceRate(entity.id, { days: 7 });
    expect(report.total).toBeGreaterThanOrEqual(2);
    expect(report.breached).toBeGreaterThanOrEqual(1);
    expect(report.complianceRate).toBeLessThan(1);
    expect(report.complianceRate).toBeGreaterThanOrEqual(0);
  });

  it("getReservationUsageReport counts reservations per reservable asset within the entity", async () => {
    const assetId = await createTestAsset();
    const [item] = await db.insert(reservationItems).values({ assetId }).returning();
    if (!item) throw new Error("Failed to insert test reservation item");
    reservationItemIds.push(item.id);

    const [r1] = await db
      .insert(reservations)
      .values({
        reservationItemId: item.id,
        beginAt: new Date("2027-08-01T09:00:00Z"),
        endAt: new Date("2027-08-01T10:00:00Z"),
        requestedByUserId: requester.id,
      })
      .returning();
    const [r2] = await db
      .insert(reservations)
      .values({
        reservationItemId: item.id,
        beginAt: new Date("2027-08-02T09:00:00Z"),
        endAt: new Date("2027-08-02T10:00:00Z"),
        requestedByUserId: requester.id,
      })
      .returning();
    reservationIds.push(r1!.id, r2!.id);

    const report = await getReservationUsageReport(entity.id);
    const row = report.find((r) => r.reservationItemId === item.id);
    expect(row?.count).toBe(2);
  });
});
