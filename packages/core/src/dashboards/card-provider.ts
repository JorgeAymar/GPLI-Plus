import {
  getAssetCountsByStatus,
  getAssetCountsByType,
  getContractsExpiringReport,
  getReservationUsageReport,
  getSlaComplianceRate,
  getTicketCountsByStatus,
  getTicketsCreatedByDay,
  getYearlyAssetsReport,
} from "../reports/report-service";

/** The 8 report-service aggregations a dashboard card can render in v1. */
export type CardKey =
  | "assets_by_type"
  | "assets_by_status"
  | "contracts_expiring"
  | "yearly_assets"
  | "tickets_by_status"
  | "reservations_usage"
  | "tickets_created_by_day"
  | "sla_compliance_rate";

export const AVAILABLE_CARD_KEYS: CardKey[] = [
  "assets_by_type",
  "assets_by_status",
  "contracts_expiring",
  "yearly_assets",
  "tickets_by_status",
  "reservations_usage",
  "tickets_created_by_day",
  "sla_compliance_rate",
];

/**
 * v1 simplification: `contracts_expiring` needs a `withinDays` parameter that
 * this registry has no way to pass through (CARD_PROVIDERS only receives
 * entityId, matching report-service's ReportOptions-less callers), so it's
 * hardcoded here. A follow-up could thread dashboardCards.options through
 * resolveCardData if per-card configurability becomes a real requirement.
 * `tickets_created_by_day`/`sla_compliance_rate` need a `days` window for the
 * same reason, so they get the same fixed 30-day cut here.
 */
const CONTRACTS_EXPIRING_WITHIN_DAYS = 30;
const STATS_REPORT_WINDOW_DAYS = 30;

/** Maps each CardKey to the report-service aggregation it renders, always scoped entity+subtree. */
export const CARD_PROVIDERS: Record<CardKey, (entityId: string) => Promise<unknown>> = {
  assets_by_type: (entityId) => getAssetCountsByType(entityId, { includeSubtree: true }),
  assets_by_status: (entityId) => getAssetCountsByStatus(entityId, { includeSubtree: true }),
  contracts_expiring: (entityId) =>
    getContractsExpiringReport(entityId, CONTRACTS_EXPIRING_WITHIN_DAYS, { includeSubtree: true }),
  yearly_assets: (entityId) => getYearlyAssetsReport(entityId, { includeSubtree: true }),
  tickets_by_status: (entityId) => getTicketCountsByStatus(entityId, { includeSubtree: true }),
  reservations_usage: (entityId) => getReservationUsageReport(entityId, { includeSubtree: true }),
  tickets_created_by_day: (entityId) =>
    getTicketsCreatedByDay(entityId, { includeSubtree: true, days: STATS_REPORT_WINDOW_DAYS }),
  sla_compliance_rate: (entityId) =>
    getSlaComplianceRate(entityId, { includeSubtree: true, days: STATS_REPORT_WINDOW_DAYS }),
};

function isCardKey(value: string): value is CardKey {
  return (AVAILABLE_CARD_KEYS as string[]).includes(value);
}

/** Resolves a dashboard card's raw data by its (untrusted, DB-stored) cardKey string; unknown keys resolve to null instead of throwing. */
export async function resolveCardData(cardKey: string, entityId: string): Promise<unknown | null> {
  if (!isCardKey(cardKey)) return null;
  return CARD_PROVIDERS[cardKey](entityId);
}
