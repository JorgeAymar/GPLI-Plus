import { requireAuthContext } from "@/lib/session";
import { AVAILABLE_CARD_KEYS, getDashboard, listDashboardCards, resolveCardData } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CARD_KEY_LABEL } from "../card-key-labels";
import { DashboardCardForm } from "./dashboard-card-form";
import { DashboardCardView } from "./dashboard-card";
import { RemoveDashboardCardButton } from "./remove-dashboard-card-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const dashboard = await getDashboard(id);
  return { title: dashboard?.name ?? "Dashboard" };
}

/**
 * v1 layout recorte (documented per the task spec): cards sit on a plain
 * 12-column CSS grid via gridColumn/gridRow spans (dashboardCards.width/height
 * as grid units) - no drag-and-drop layout engine (gridstack-style). Cards
 * flow in `createdAt` order, sized by width/height only; positionX/positionY
 * are persisted on the row and returned by listDashboardCards, but this page
 * does not yet turn them into explicit gridColumnStart/gridRowStart. A future
 * manual-repositioning UI would need to wire positionX/positionY into actual
 * grid placement, not just size.
 */
export default async function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAuthContext();

  const dashboard = await getDashboard(id);
  if (!dashboard) notFound();

  const cards = await listDashboardCards(id);
  const cardsWithData = await Promise.all(
    cards.map(async (card) => ({
      card,
      data: await resolveCardData(card.cardKey, context.activeEntity.id),
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{dashboard.name}</h1>
        <p className="mt-1 text-xs opacity-50">{dashboard.key}</p>
      </div>

      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Cards del dashboard</h2>
        <div className="grid grid-cols-12 gap-4">
          {cardsWithData.map(({ card, data }) => (
            <div
              key={card.id}
              className="rounded-md border border-black/10 p-3 dark:border-white/10"
              style={{ gridColumn: `span ${card.width}`, gridRow: `span ${card.height}` }}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">{CARD_KEY_LABEL[card.cardKey] ?? card.cardKey}</h3>
                <RemoveDashboardCardButton id={card.id} dashboardId={dashboard.id} />
              </div>
              <DashboardCardView
                cardKey={card.cardKey}
                data={data}
                chartType={(card.options as { chartType?: string } | null)?.chartType}
              />
            </div>
          ))}
          {cards.length === 0 ? <p className="col-span-12 text-sm opacity-50">Sin cards todavía.</p> : null}
        </div>
      </div>

      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Agregar card</h2>
        <DashboardCardForm dashboardId={dashboard.id} availableCardKeys={AVAILABLE_CARD_KEYS} />
      </div>
    </div>
  );
}
