import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { assetDefinitions, assets, db, queuedNotifications, savedSearchAlerts, savedSearches, tickets, type Entity, type User } from "@itsm/db";
import { createTestEntity, createTestUser, deleteTestEntities, deleteTestUsers } from "../__vitest_tools__/fixtures";
import {
  createSavedSearch,
  createSavedSearchAlert,
  listActiveSavedSearchAlerts,
  listSavedSearches,
  resolveSavedSearchCount,
  runSavedSearchAlertsSweep,
} from "./saved-search-service";

describe("saved-search-service", () => {
  let entity: Entity;
  let owner: User;
  let otherUser: User;
  let assetDefinitionId: string;

  const entityIds: string[] = [];
  const userIds: string[] = [];
  const savedSearchIds: string[] = [];
  const alertIds: string[] = [];
  const ticketIds: string[] = [];
  const assetIds: string[] = [];

  beforeAll(async () => {
    entity = await createTestEntity();
    entityIds.push(entity.id);
    owner = await createTestUser();
    otherUser = await createTestUser();
    userIds.push(owner.id, otherUser.id);

    const [existingDefinition] = await db.select().from(assetDefinitions).limit(1);
    if (!existingDefinition) throw new Error("Expected at least one seeded asset definition");
    assetDefinitionId = existingDefinition.id;
  });

  afterAll(async () => {
    // runSavedSearchAlertsSweep() may queue notifications beyond the ones explicitly captured by a
    // single test (later tests' sweeps also reprocess earlier tests' still-active alerts), so clean
    // up every notification addressed to either test user rather than tracking individual ids.
    await db.delete(queuedNotifications).where(inArray(queuedNotifications.recipientUserId, userIds));
    for (const id of alertIds) {
      await db.delete(savedSearchAlerts).where(eq(savedSearchAlerts.id, id));
    }
    for (const id of savedSearchIds) {
      await db.delete(savedSearches).where(eq(savedSearches.id, id));
    }
    for (const id of ticketIds) {
      await db.delete(tickets).where(eq(tickets.id, id));
    }
    for (const id of assetIds) {
      await db.delete(assets).where(eq(assets.id, id));
    }
    await deleteTestUsers(userIds);
    await deleteTestEntities(entityIds);
  });

  async function makeSavedSearch(overrides?: Partial<Parameters<typeof createSavedSearch>[0]>) {
    const search = await createSavedSearch({
      name: `__vitest_tools__ search ${crypto.randomUUID().slice(0, 8)}`,
      itemType: "ticket",
      ownerUserId: owner.id,
      entityId: entity.id,
      ...overrides,
    });
    savedSearchIds.push(search.id);
    return search;
  }

  it("createSavedSearch defaults to private, and listSavedSearches returns own + others' shared (non-private) searches", async () => {
    const ownPrivate = await makeSavedSearch();
    expect(ownPrivate.isPrivate).toBe(true);

    const othersShared = await makeSavedSearch({ ownerUserId: otherUser.id, isPrivate: false });
    const othersPrivate = await makeSavedSearch({ ownerUserId: otherUser.id, isPrivate: true });

    const ownerView = await listSavedSearches(owner.id);
    const ids = ownerView.map((s) => s.id);
    expect(ids).toContain(ownPrivate.id);
    expect(ids).toContain(othersShared.id);
    expect(ids).not.toContain(othersPrivate.id);
  });

  it("listSavedSearches filters by itemType when provided", async () => {
    const ticketSearch = await makeSavedSearch({ itemType: "ticket" });
    const assetSearch = await makeSavedSearch({ itemType: "asset" });

    const ticketsOnly = await listSavedSearches(owner.id, "ticket");
    const ids = ticketsOnly.map((s) => s.id);
    expect(ids).toContain(ticketSearch.id);
    expect(ids).not.toContain(assetSearch.id);
  });

  it("resolveSavedSearchCount counts tickets/assets in the entity subtree, and returns null for an unregistered itemType", async () => {
    const [ticket] = await db
      .insert(tickets)
      .values({ entityId: entity.id, title: "__vitest_tools__ ticket", content: "content" })
      .returning();
    ticketIds.push(ticket!.id);

    const [asset] = await db
      .insert(assets)
      .values({ entityId: entity.id, assetDefinitionId, name: "__vitest_tools__ asset" })
      .returning();
    assetIds.push(asset!.id);

    const ticketCount = await resolveSavedSearchCount("ticket", entity.id);
    expect(ticketCount).toBeGreaterThanOrEqual(1);

    const assetCount = await resolveSavedSearchCount("asset", entity.id);
    expect(assetCount).toBeGreaterThanOrEqual(1);

    const unknownCount = await resolveSavedSearchCount("__vitest_tools__not_a_real_type", entity.id);
    expect(unknownCount).toBeNull();
  });

  it("createSavedSearchAlert + listActiveSavedSearchAlerts joins in the parent saved search", async () => {
    const search = await makeSavedSearch();
    const alert = await createSavedSearchAlert({ savedSearchId: search.id, operator: "gte", thresholdValue: 1 });
    alertIds.push(alert.id);

    const active = await listActiveSavedSearchAlerts();
    const found = active.find((a) => a.alert.id === alert.id);
    expect(found).toBeDefined();
    expect(found?.savedSearch.id).toBe(search.id);
  });

  it("runSavedSearchAlertsSweep queues a notification when the threshold is met, and stamps lastCheckedAt", async () => {
    const [ticket] = await db
      .insert(tickets)
      .values({ entityId: entity.id, title: "__vitest_tools__ sweep ticket", content: "content" })
      .returning();
    ticketIds.push(ticket!.id);

    const search = await makeSavedSearch({ doCount: "yes" });
    const alert = await createSavedSearchAlert({ savedSearchId: search.id, operator: "gte", thresholdValue: 1 });
    alertIds.push(alert.id);

    const queuedCount = await runSavedSearchAlertsSweep();
    expect(queuedCount).toBeGreaterThanOrEqual(1);

    const notifications = await db.select().from(queuedNotifications).where(eq(queuedNotifications.recipientUserId, owner.id));
    expect(notifications.some((n) => n.templateKey === "saved_search_alert")).toBe(true);

    const [alertAfter] = await db.select().from(savedSearchAlerts).where(eq(savedSearchAlerts.id, alert.id));
    expect(alertAfter?.lastCheckedAt).not.toBeNull();
  });

  it("runSavedSearchAlertsSweep skips alerts whose saved search opted out via doCount='no'", async () => {
    const search = await makeSavedSearch({ doCount: "no" });
    const alert = await createSavedSearchAlert({ savedSearchId: search.id, operator: "gte", thresholdValue: 0 });
    alertIds.push(alert.id);

    await runSavedSearchAlertsSweep();

    const [alertAfter] = await db.select().from(savedSearchAlerts).where(eq(savedSearchAlerts.id, alert.id));
    // Skipped entirely (the `continue` happens before the lastCheckedAt stamp), so it's never touched.
    expect(alertAfter?.lastCheckedAt).toBeNull();
  });

  it("runSavedSearchAlertsSweep does not re-fire before frequencyMinutes has elapsed since the last check", async () => {
    const search = await makeSavedSearch({ doCount: "yes" });
    const alert = await createSavedSearchAlert({
      savedSearchId: search.id,
      operator: "gte",
      thresholdValue: 0,
      frequencyMinutes: 60,
    });
    alertIds.push(alert.id);

    // First sweep stamps lastCheckedAt "now".
    await runSavedSearchAlertsSweep();
    const [afterFirst] = await db.select().from(savedSearchAlerts).where(eq(savedSearchAlerts.id, alert.id));
    const firstCheckedAt = afterFirst?.lastCheckedAt ?? null;
    expect(firstCheckedAt).not.toBeNull();

    // Second sweep, immediately after, should be throttled and leave lastCheckedAt untouched.
    await runSavedSearchAlertsSweep();
    const [afterSecond] = await db.select().from(savedSearchAlerts).where(eq(savedSearchAlerts.id, alert.id));
    expect(afterSecond?.lastCheckedAt?.getTime()).toBe(firstCheckedAt?.getTime());
  });
});
