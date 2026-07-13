import {
  assetDefinitions,
  assets,
  contracts,
  db,
  dropdownItems,
  itilSlaAssignments,
  reservationItems,
  reservations,
  tickets,
  type Contract,
  type ItilStatus,
} from "@itsm/db";
import { and, asc, count, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

/**
 * Reports module has NO tables of its own (same as upstream GLPI) - every
 * function here is on-the-fly aggregation (count/group by) over tables owned
 * by other domains (assets, contracts, tickets). Nothing in this file mutates
 * data.
 */

export interface ReportOptions {
  includeSubtree?: boolean;
}

/** Resolves the entity scope: just `entityId`, or `entityId` + every descendant. */
async function resolveEntityIds(entityId: string, options?: ReportOptions): Promise<string[]> {
  return options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
}

export interface AssetCountByType {
  assetDefinitionId: string;
  name: string;
  count: number;
}

/** Active (non-deleted) asset counts grouped by asset type, richest type first. */
export async function getAssetCountsByType(entityId: string, options?: ReportOptions): Promise<AssetCountByType[]> {
  const entityIds = await resolveEntityIds(entityId, options);

  return db
    .select({
      assetDefinitionId: assets.assetDefinitionId,
      name: assetDefinitions.name,
      count: count(),
    })
    .from(assets)
    .innerJoin(assetDefinitions, eq(assetDefinitions.id, assets.assetDefinitionId))
    .where(and(inArray(assets.entityId, entityIds), isNull(assets.deletedAt)))
    .groupBy(assets.assetDefinitionId, assetDefinitions.name)
    .orderBy(desc(count()));
}

export interface AssetCountByStatus {
  statusDropdownItemId: string | null;
  name: string;
  count: number;
}

/** Active asset counts grouped by status dropdown item; assets with no status land in "Sin estado". */
export async function getAssetCountsByStatus(entityId: string, options?: ReportOptions): Promise<AssetCountByStatus[]> {
  const entityIds = await resolveEntityIds(entityId, options);

  const rows = await db
    .select({
      statusDropdownItemId: assets.statusDropdownItemId,
      name: dropdownItems.name,
      count: count(),
    })
    .from(assets)
    .leftJoin(dropdownItems, eq(dropdownItems.id, assets.statusDropdownItemId))
    .where(and(inArray(assets.entityId, entityIds), isNull(assets.deletedAt)))
    .groupBy(assets.statusDropdownItemId, dropdownItems.name)
    .orderBy(desc(count()));

  return rows.map((r) => ({
    statusDropdownItemId: r.statusDropdownItemId,
    name: r.name ?? "Sin estado",
    count: r.count,
  }));
}

/**
 * Contracts (active, non-deleted) whose endDate falls within [now, now + withinDays].
 * Computed entirely in JS (no raw `sql` interval math) so `withinDays` never
 * touches a query template as a string - it's just a plain Date bound.
 */
export async function getContractsExpiringReport(entityId: string, withinDays: number, options?: ReportOptions): Promise<Contract[]> {
  const entityIds = await resolveEntityIds(entityId, options);
  const now = new Date();
  const limit = new Date(now.getTime() + withinDays * 86_400_000);

  return db
    .select()
    .from(contracts)
    .where(
      and(
        inArray(contracts.entityId, entityIds),
        isNull(contracts.deletedAt),
        gte(contracts.endDate, now),
        lte(contracts.endDate, limit),
      ),
    )
    .orderBy(asc(contracts.endDate));
}

export interface YearlyAssetCount {
  year: number;
  count: number;
}

/**
 * Asset intake by year of `createdAt`. Grouped in JS (Map<year, count>) rather
 * than a `sql\`extract(year from ...)\`` groupBy expression - same result,
 * simpler types.
 */
export async function getYearlyAssetsReport(entityId: string, options?: ReportOptions): Promise<YearlyAssetCount[]> {
  const entityIds = await resolveEntityIds(entityId, options);

  const rows = await db
    .select({ createdAt: assets.createdAt })
    .from(assets)
    .where(and(inArray(assets.entityId, entityIds), isNull(assets.deletedAt)));

  const countsByYear = new Map<number, number>();
  for (const row of rows) {
    const year = row.createdAt.getFullYear();
    countsByYear.set(year, (countsByYear.get(year) ?? 0) + 1);
  }

  return [...countsByYear.entries()].map(([year, yearCount]) => ({ year, count: yearCount })).sort((a, b) => a.year - b.year);
}

export interface TicketCountByStatus {
  status: ItilStatus;
  count: number;
}

/** Ticket counts grouped by ITIL status (new/assigned/planned/pending/solved/closed). Tickets have no deletedAt column. */
export async function getTicketCountsByStatus(entityId: string, options?: ReportOptions): Promise<TicketCountByStatus[]> {
  const entityIds = await resolveEntityIds(entityId, options);

  return db
    .select({ status: tickets.status, count: count() })
    .from(tickets)
    .where(inArray(tickets.entityId, entityIds))
    .groupBy(tickets.status)
    .orderBy(desc(count()));
}

export interface ReservationUsageCount {
  reservationItemId: string;
  assetName: string;
  count: number;
}

/** Reservation counts per reservable asset (added post-integration once packages/db/src/schema/reservations.ts existed). */
export async function getReservationUsageReport(entityId: string, options?: ReportOptions): Promise<ReservationUsageCount[]> {
  const entityIds = await resolveEntityIds(entityId, options);

  return db
    .select({
      reservationItemId: reservationItems.id,
      assetName: assets.name,
      count: count(),
    })
    .from(reservations)
    .innerJoin(reservationItems, eq(reservationItems.id, reservations.reservationItemId))
    .innerJoin(assets, eq(assets.id, reservationItems.assetId))
    .where(inArray(assets.entityId, entityIds))
    .groupBy(reservationItems.id, assets.name)
    .orderBy(desc(count()));
}

export interface TicketsCreatedByDay {
  date: string;
  count: number;
}

/**
 * Ticket intake per day of `createdAt` over the trailing `days` days, entity(+subtree) scoped.
 * Grouped in JS (Map<dateString, count>) - same principle as getYearlyAssetsReport, just bucketed
 * by ISO day (`toISOString().slice(0, 10)`) instead of by year. Days with zero tickets are filled
 * in with count: 0 so a time-series chart never has gaps.
 */
export async function getTicketsCreatedByDay(
  entityId: string,
  options: ReportOptions & { days: number },
): Promise<TicketsCreatedByDay[]> {
  const entityIds = await resolveEntityIds(entityId, options);
  const now = new Date();
  const since = new Date(now.getTime() - options.days * 86_400_000);

  const rows = await db
    .select({ createdAt: tickets.createdAt })
    .from(tickets)
    .where(and(inArray(tickets.entityId, entityIds), gte(tickets.createdAt, since)));

  const countsByDay = new Map<string, number>();
  for (const row of rows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
  }

  // Fill in every day of the requested window that had zero tickets.
  for (let i = 0; i < options.days; i++) {
    const day = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    if (!countsByDay.has(day)) countsByDay.set(day, 0);
  }

  return [...countsByDay.entries()]
    .map(([date, dayCount]) => ({ date, count: dayCount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SlaComplianceRate {
  total: number;
  breached: number;
  complianceRate: number;
}

/**
 * SLA compliance rate over the trailing `days` days (window applied to `dueAt`), entity(+subtree) scoped.
 * `itil_sla_assignments` is polymorphic (itilType/itilId, no entityId of its own) - same problem
 * sla-service.ts's ITIL_TABLES map solves for the escalation sweep's audit log. This report only
 * covers itilType: "ticket" assignments (joined against `tickets` for the entity filter), matching
 * the rest of this file's ticket-only report surface (see getTicketCountsByStatus) - extending to
 * problem/change assignments is a follow-up once this module has reports for those ITIL objects too.
 * complianceRate is 1 (100%, vacuously) when total === 0 - nothing to breach.
 */
export async function getSlaComplianceRate(
  entityId: string,
  options: ReportOptions & { days: number },
): Promise<SlaComplianceRate> {
  const entityIds = await resolveEntityIds(entityId, options);
  const now = new Date();
  const since = new Date(now.getTime() - options.days * 86_400_000);

  const rows = await db
    .select({ isBreached: itilSlaAssignments.isBreached })
    .from(itilSlaAssignments)
    .innerJoin(tickets, eq(tickets.id, itilSlaAssignments.itilId))
    .where(
      and(
        eq(itilSlaAssignments.itilType, "ticket"),
        inArray(tickets.entityId, entityIds),
        gte(itilSlaAssignments.dueAt, since),
        lte(itilSlaAssignments.dueAt, now),
      ),
    );

  const total = rows.length;
  const breached = rows.filter((r) => r.isBreached).length;
  const complianceRate = total === 0 ? 1 : (total - breached) / total;

  return { total, breached, complianceRate };
}
