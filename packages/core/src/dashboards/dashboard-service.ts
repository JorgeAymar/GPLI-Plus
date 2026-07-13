import {
  dashboardCards,
  dashboards,
  db,
  type Dashboard,
  type DashboardCard,
  type VisibilityGranteeKind,
} from "@itsm/db";
import { asc, eq } from "drizzle-orm";
import type { AuthContext } from "../auth/get-auth-context";
import { addVisibilityRule, isResourceVisibleTo } from "../visibility/visibility-service";

export async function createDashboard(input: { key: string; name: string; ownerUserId: string }): Promise<Dashboard> {
  const [created] = await db
    .insert(dashboards)
    .values({
      key: input.key,
      name: input.name,
      ownerUserId: input.ownerUserId,
    })
    .returning();
  if (!created) throw new Error("Failed to insert dashboard");
  return created;
}

export async function getDashboard(id: string): Promise<Dashboard | undefined> {
  const [dashboard] = await db.select().from(dashboards).where(eq(dashboards.id, id));
  return dashboard;
}

export async function getDashboardByKey(key: string): Promise<Dashboard | undefined> {
  const [dashboard] = await db.select().from(dashboards).where(eq(dashboards.key, key));
  return dashboard;
}

/** Same per-row visibility pattern as listKbArticles/listRssFeeds: candidates first, filtered through the shared visibility-service instead of a bespoke join. */
export async function listDashboardsVisibleTo(context: AuthContext): Promise<Dashboard[]> {
  const candidates = await db.select().from(dashboards).orderBy(dashboards.name);
  const visible: Dashboard[] = [];
  for (const dashboard of candidates) {
    if (await isResourceVisibleTo("dashboard", dashboard.id, dashboard.ownerUserId, context)) {
      visible.push(dashboard);
    }
  }
  return visible;
}

export async function addDashboardCard(input: {
  dashboardId: string;
  cardKey: string;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  options?: Record<string, unknown>;
}): Promise<DashboardCard> {
  const [created] = await db
    .insert(dashboardCards)
    .values({
      dashboardId: input.dashboardId,
      cardKey: input.cardKey,
      ...(input.positionX !== undefined ? { positionX: input.positionX } : {}),
      ...(input.positionY !== undefined ? { positionY: input.positionY } : {}),
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
      ...(input.options !== undefined ? { options: input.options } : {}),
    })
    .returning();
  if (!created) throw new Error("Failed to insert dashboard card");
  return created;
}

export async function listDashboardCards(dashboardId: string): Promise<DashboardCard[]> {
  return db.select().from(dashboardCards).where(eq(dashboardCards.dashboardId, dashboardId)).orderBy(asc(dashboardCards.createdAt));
}

export async function updateDashboardCardPosition(
  id: string,
  input: { positionX: number; positionY: number; width?: number; height?: number },
): Promise<DashboardCard> {
  const [updated] = await db
    .update(dashboardCards)
    .set({
      positionX: input.positionX,
      positionY: input.positionY,
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
    })
    .where(eq(dashboardCards.id, id))
    .returning();
  if (!updated) throw new Error(`Failed to update dashboard card ${id}`);
  return updated;
}

export async function removeDashboardCard(id: string): Promise<void> {
  await db.delete(dashboardCards).where(eq(dashboardCards.id, id));
}

/** Thin wrapper over the shared visibility-service - dashboards have no dedicated "dashboard_shares" table, see visibility.ts. */
export async function shareDashboard(
  dashboardId: string,
  granteeKind: VisibilityGranteeKind,
  granteeId: string,
  isRecursive?: boolean,
) {
  return addVisibilityRule({
    resourceType: "dashboard",
    resourceId: dashboardId,
    granteeKind,
    granteeId,
    isRecursive,
  });
}
