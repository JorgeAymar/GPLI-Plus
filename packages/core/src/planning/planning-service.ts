import { and, eq, gte, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { assets, changes, db, projects, reservationItems, reservations } from "@itsm/db";
import { listSubtree } from "../entities/entity-service";

/**
 * Planning has NO table of its own (same pattern as reports/report-service.ts)
 * - it's a read-only aggregation over three domains that each already track a
 * planned date range (Changes, Projects, Reservations). Nothing here mutates
 * data; it just concatenates + sorts what those domains already store.
 */

export type PlanningItemType = "change" | "project" | "reservation";

export interface PlanningItem {
  itemType: PlanningItemType;
  itemId: string;
  title: string;
  startAt: Date;
  endAt: Date;
}

export interface PlanningOptions {
  from: Date;
  to: Date;
  includeSubtree?: boolean;
}

/** Resolves the entity scope: just `entityId`, or `entityId` + every descendant. Mirrors resolveEntityIds() in reports/report-service.ts. */
async function resolveEntityIds(entityId: string, options: { includeSubtree?: boolean }): Promise<string[]> {
  return options.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
}

/**
 * Changes whose [plannedStartAt, plannedEndAt] overlaps [from, to]. Changes
 * with no plannedStartAt are never "planned" so they're excluded outright;
 * a change with no plannedEndAt is treated as a point-in-time event (endAt
 * falls back to plannedStartAt).
 */
async function getPlannedChanges(entityIds: string[], from: Date, to: Date): Promise<PlanningItem[]> {
  const rows = await db
    .select({ id: changes.id, title: changes.title, plannedStartAt: changes.plannedStartAt, plannedEndAt: changes.plannedEndAt })
    .from(changes)
    .where(
      and(
        inArray(changes.entityId, entityIds),
        isNotNull(changes.plannedStartAt),
        lte(changes.plannedStartAt, to),
        or(isNull(changes.plannedEndAt), gte(changes.plannedEndAt, from)),
      ),
    );

  return rows
    .filter((r): r is typeof r & { plannedStartAt: Date } => r.plannedStartAt !== null)
    .map((r) => ({
      itemType: "change" as const,
      itemId: r.id,
      title: r.title,
      startAt: r.plannedStartAt,
      endAt: r.plannedEndAt ?? r.plannedStartAt,
    }));
}

/** Projects whose [planStartAt, planEndAt] overlaps [from, to]. Same open-ended treatment as changes. */
async function getPlannedProjects(entityIds: string[], from: Date, to: Date): Promise<PlanningItem[]> {
  const rows = await db
    .select({ id: projects.id, name: projects.name, planStartAt: projects.planStartAt, planEndAt: projects.planEndAt })
    .from(projects)
    .where(
      and(
        inArray(projects.entityId, entityIds),
        isNotNull(projects.planStartAt),
        lte(projects.planStartAt, to),
        or(isNull(projects.planEndAt), gte(projects.planEndAt, from)),
      ),
    );

  return rows
    .filter((r): r is typeof r & { planStartAt: Date } => r.planStartAt !== null)
    .map((r) => ({
      itemType: "project" as const,
      itemId: r.id,
      title: r.name,
      startAt: r.planStartAt,
      endAt: r.planEndAt ?? r.planStartAt,
    }));
}

/**
 * Reservations whose [beginAt, endAt] overlaps [from, to]. The entity scope
 * lives on the reserved asset, not on the reservation, so this joins through
 * reservationItems -> assets (same double join as getReservationUsageReport()
 * in reports/report-service.ts) to both filter by entity and get the asset
 * name for the title.
 */
async function getPlannedReservations(entityIds: string[], from: Date, to: Date): Promise<PlanningItem[]> {
  const rows = await db
    .select({ id: reservations.id, assetName: assets.name, beginAt: reservations.beginAt, endAt: reservations.endAt })
    .from(reservations)
    .innerJoin(reservationItems, eq(reservationItems.id, reservations.reservationItemId))
    .innerJoin(assets, eq(assets.id, reservationItems.assetId))
    .where(and(inArray(assets.entityId, entityIds), lte(reservations.beginAt, to), gte(reservations.endAt, from)));

  return rows.map((r) => ({
    itemType: "reservation" as const,
    itemId: r.id,
    title: `Reserva: ${r.assetName}`,
    startAt: r.beginAt,
    endAt: r.endAt,
  }));
}

/**
 * Unified read-only view of everything with a planned date overlapping
 * [from, to]: Changes, Projects, Reservations. Concatenates the three
 * per-domain queries and sorts by startAt ascending.
 */
export async function getPlanningItems(entityId: string, options: PlanningOptions): Promise<PlanningItem[]> {
  const entityIds = await resolveEntityIds(entityId, options);
  const { from, to } = options;

  const [changeItems, projectItems, reservationPlanningItems] = await Promise.all([
    getPlannedChanges(entityIds, from, to),
    getPlannedProjects(entityIds, from, to),
    getPlannedReservations(entityIds, from, to),
  ]);

  return [...changeItems, ...projectItems, ...reservationPlanningItems].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
