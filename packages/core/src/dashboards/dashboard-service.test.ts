import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { dashboardCards, dashboards, db, resourceVisibilityRules, type Entity, type Profile, type User } from "@itsm/db";
import {
  buildAuthContext,
  createTestEntity,
  createTestProfile,
  createTestUser,
  deleteTestEntities,
  deleteTestProfiles,
  deleteTestUsers,
} from "../__vitest_tools__/fixtures";
import {
  addDashboardCard,
  createDashboard,
  getDashboard,
  getDashboardByKey,
  listDashboardCards,
  listDashboardsVisibleTo,
  removeDashboardCard,
  shareDashboard,
  updateDashboardCardPosition,
} from "./dashboard-service";

describe("dashboard-service", () => {
  let entity: Entity;
  let profile: Profile;
  let owner: User;
  let otherUser: User;

  const entityIds: string[] = [];
  const profileIds: string[] = [];
  const userIds: string[] = [];
  const dashboardIds: string[] = [];

  beforeAll(async () => {
    entity = await createTestEntity();
    entityIds.push(entity.id);
    profile = await createTestProfile();
    profileIds.push(profile.id);
    owner = await createTestUser();
    otherUser = await createTestUser();
    userIds.push(owner.id, otherUser.id);
  });

  afterAll(async () => {
    for (const dashboardId of dashboardIds) {
      await db.delete(resourceVisibilityRules).where(eq(resourceVisibilityRules.resourceId, dashboardId));
      await db.delete(dashboardCards).where(eq(dashboardCards.dashboardId, dashboardId));
    }
    for (const dashboardId of dashboardIds) {
      await db.delete(dashboards).where(eq(dashboards.id, dashboardId));
    }
    await deleteTestProfiles(profileIds);
    await deleteTestUsers(userIds);
    await deleteTestEntities(entityIds);
  });

  async function makeDashboard() {
    const dashboard = await createDashboard({
      key: `__vitest_tools__-${crypto.randomUUID().slice(0, 8)}`,
      name: "__vitest_tools__ dashboard",
      ownerUserId: owner.id,
    });
    dashboardIds.push(dashboard.id);
    return dashboard;
  }

  it("createDashboard + getDashboard + getDashboardByKey roundtrip", async () => {
    const dashboard = await makeDashboard();

    const byId = await getDashboard(dashboard.id);
    expect(byId?.id).toBe(dashboard.id);

    const byKey = await getDashboardByKey(dashboard.key);
    expect(byKey?.id).toBe(dashboard.id);
  });

  it("a private dashboard is invisible to another user until shareDashboard grants access", async () => {
    const dashboard = await makeDashboard();

    const ownerContext = buildAuthContext(owner, entity, profile);
    const otherContext = buildAuthContext(otherUser, entity, profile);

    const ownVisible = await listDashboardsVisibleTo(ownerContext);
    expect(ownVisible.map((d) => d.id)).toContain(dashboard.id);

    const beforeShare = await listDashboardsVisibleTo(otherContext);
    expect(beforeShare.map((d) => d.id)).not.toContain(dashboard.id);

    await shareDashboard(dashboard.id, "user", otherUser.id);

    const afterShare = await listDashboardsVisibleTo(otherContext);
    expect(afterShare.map((d) => d.id)).toContain(dashboard.id);
  });

  it("addDashboardCard + listDashboardCards + updateDashboardCardPosition + removeDashboardCard", async () => {
    const dashboard = await makeDashboard();

    const card = await addDashboardCard({ dashboardId: dashboard.id, cardKey: "assets_by_status", positionX: 0, positionY: 0 });
    let cards = await listDashboardCards(dashboard.id);
    expect(cards.map((c) => c.id)).toContain(card.id);

    const moved = await updateDashboardCardPosition(card.id, { positionX: 4, positionY: 3, width: 6 });
    expect(moved.positionX).toBe(4);
    expect(moved.positionY).toBe(3);
    expect(moved.width).toBe(6);

    await removeDashboardCard(card.id);
    cards = await listDashboardCards(dashboard.id);
    expect(cards.map((c) => c.id)).not.toContain(card.id);
  });
});
