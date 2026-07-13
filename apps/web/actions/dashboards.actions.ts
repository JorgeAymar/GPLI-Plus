"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  addDashboardCard,
  addDashboardCardSchema,
  createDashboard,
  createDashboardSchema,
  removeDashboardCard,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createDashboardAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_DASHBOARD, RIGHT.CREATE);
  const parsed = createDashboardSchema.parse(input);
  // ownerUserId always comes from the session, never from client input.
  const dashboard = await createDashboard({ ...parsed, ownerUserId: context.user.id });
  revalidatePath("/tools/dashboards");
  return dashboard;
}

export async function addDashboardCardAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_DASHBOARD, RIGHT.UPDATE);
  const parsed = addDashboardCardSchema.parse(input);
  const card = await addDashboardCard(parsed);
  revalidatePath(`/tools/dashboards/${parsed.dashboardId}`);
  return card;
}

// removeDashboardCard(id) alone has no way to know which dashboard to revalidate,
// so - like addProjectTaskLinkAction in projects.actions.ts - the caller passes
// dashboardId separately purely for the revalidatePath call.
export async function removeDashboardCardAction(id: string, dashboardId: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_DASHBOARD, RIGHT.UPDATE);
  await removeDashboardCard(id);
  revalidatePath(`/tools/dashboards/${dashboardId}`);
}
