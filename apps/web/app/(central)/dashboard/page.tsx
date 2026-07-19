import { StatTile } from "@/components/stat-tile";
import { requireAuthContext } from "@/lib/session";
import {
  getAssetCountsByType,
  getContractsExpiringReport,
  getEffectiveRights,
  getSlaComplianceRate,
  getTicketCountsByStatus,
  hasRight,
  MODULE,
  RIGHT,
} from "@itsm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

const SLA_WINDOW_DAYS = 30;
const CONTRACTS_WINDOW_DAYS = 30;

/**
 * Ticket ITIL statuses counted as "open" for the summary tile - everything
 * except the two resolved states. Same status set as the STATUS_LABELS map
 * in app/(central)/tools/reports/tickets-by-status/page.tsx.
 */
const OPEN_TICKET_STATUSES = new Set(["new", "assigned", "planned", "pending"]);

export default async function DashboardPage() {
  const context = await requireAuthContext();
  const t = await getTranslations("dashboard");

  // Same principle as tools/reports/page.tsx: Dashboard has no rights of its
  // own over these numbers, so each tile is gated by READ on the module that
  // owns the underlying rows (and is hidden, not zeroed, when missing).
  const [ticketRights, assetRights, contractRights] = await Promise.all([
    getEffectiveRights(context.user.id, context.activeEntity.id, MODULE.ASSISTANCE_TICKET),
    getEffectiveRights(context.user.id, context.activeEntity.id, MODULE.ASSETS_GENERIC),
    getEffectiveRights(context.user.id, context.activeEntity.id, MODULE.MANAGEMENT_CONTRACT),
  ]);

  const canReadTickets = hasRight(ticketRights, RIGHT.READ);
  const canReadAssets = hasRight(assetRights, RIGHT.READ);
  const canReadContracts = hasRight(contractRights, RIGHT.READ);

  const [ticketStatusCounts, slaCompliance, assetTypeCounts, expiringContracts] = await Promise.all([
    canReadTickets ? getTicketCountsByStatus(context.activeEntity.id, { includeSubtree: true }) : null,
    canReadTickets ? getSlaComplianceRate(context.activeEntity.id, { includeSubtree: true, days: SLA_WINDOW_DAYS }) : null,
    canReadAssets ? getAssetCountsByType(context.activeEntity.id, { includeSubtree: true }) : null,
    canReadContracts
      ? getContractsExpiringReport(context.activeEntity.id, CONTRACTS_WINDOW_DAYS, { includeSubtree: true })
      : null,
  ]);

  const openTicketsCount = ticketStatusCounts
    ? ticketStatusCounts.reduce((sum, r) => (OPEN_TICKET_STATUSES.has(r.status) ? sum + r.count : sum), 0)
    : null;
  const totalAssetsCount = assetTypeCounts ? assetTypeCounts.reduce((sum, r) => sum + r.count, 0) : null;

  const hasAnyTile = openTicketsCount !== null || slaCompliance !== null || totalAssetsCount !== null || expiringContracts !== null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm opacity-70">
          {t("activeEntity")}: <strong>{context.activeEntity.name}</strong> · {t("activeProfile")}:{" "}
          <strong>{context.activeProfile.name}</strong> ({context.activeProfile.interface})
        </p>
      </div>

      {hasAnyTile ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {openTicketsCount !== null ? (
            <StatTile label={t("openTickets")} value={openTicketsCount} href="/tools/reports/tickets-by-status" cta={t("viewReport")} />
          ) : null}

          {slaCompliance !== null ? (
            <StatTile
              label={t("slaCompliance")}
              value={`${(slaCompliance.complianceRate * 100).toFixed(1)}%`}
              href="/tools/reports/sla-compliance"
              cta={t("viewReport")}
              variant={
                slaCompliance.complianceRate >= 0.95 ? "success" : slaCompliance.complianceRate < 0.8 ? "danger" : "neutral"
              }
            />
          ) : null}

          {totalAssetsCount !== null ? (
            <StatTile label={t("totalAssets")} value={totalAssetsCount} href="/tools/reports/assets-by-type" cta={t("viewReport")} />
          ) : null}

          {expiringContracts !== null ? (
            <StatTile
              label={t("contractsExpiring")}
              value={expiringContracts.length}
              href="/tools/reports/contracts-expiring"
              cta={t("viewReport")}
            />
          ) : null}
        </div>
      ) : null}

      {process.env.AI_ASSISTANT_URL ? (
        <div className="rounded-md border border-black/10 p-4 dark:border-white/10">
          <h2 className="text-sm font-medium opacity-70">{t("assistantHeading")}</h2>
          <p className="mt-1 text-sm opacity-70">{t("assistantDescription")}</p>
          <Link href="/assistant" className="mt-3 inline-block rounded-md bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover">
            {t("assistantCta")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
