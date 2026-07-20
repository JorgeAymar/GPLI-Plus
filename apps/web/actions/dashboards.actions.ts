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
import type { Dashboard } from "@itsm/db";
import { revalidatePath } from "next/cache";

export interface CreateDashboardResult {
  dashboard?: Dashboard;
  error?: string;
}

/**
 * Returns `{error}` instead of throwing on a uniqueness failure - Next.js
 * redacts thrown Server Action errors in production (see users.actions.ts's
 * createUserAction for the full explanation). `createDashboardSchema.parse`
 * is deliberately left outside the try: it can throw a raw ZodError (a
 * pre-existing, separate issue in this file), and catching it here would
 * newly surface that unrelated raw message instead of Next's redaction.
 */
export async function createDashboardAction(input: unknown): Promise<CreateDashboardResult> {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_DASHBOARD, RIGHT.CREATE);
  const parsed = createDashboardSchema.parse(input);

  let dashboard: Dashboard;
  try {
    // ownerUserId always comes from the session, never from client input.
    dashboard = await createDashboard({ ...parsed, ownerUserId: context.user.id });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear el dashboard." };
  }
  revalidatePath("/tools/dashboards");
  return { dashboard };
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
