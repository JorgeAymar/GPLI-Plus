/**
 * Plain data map, no "use client"/"use server" - safely importable from both
 * the [id]/page.tsx Server Component and the Client Component forms/cards
 * without dragging any @itsm/core runtime code (and therefore @itsm/db's `db`
 * connection) into the browser bundle. See dashboard-card.tsx / dashboard-card-form.tsx
 * for why CardKey/AVAILABLE_CARD_KEYS themselves are only ever `import type`'d
 * on the client side.
 */
export const CARD_KEY_LABEL: Record<string, string> = {
  assets_by_type: "Activos por tipo",
  assets_by_status: "Activos por estado",
  contracts_expiring: "Contratos por vencer",
  yearly_assets: "Activos por año",
  tickets_by_status: "Tickets por estado",
  reservations_usage: "Uso de reservas",
  // These two were missing even though AVAILABLE_CARD_KEYS (card-provider.ts)
  // has included them since v1: without an entry here the "Card" <select> and
  // the card heading on the dashboard detail page fell back to the raw
  // snake_case key (`CARD_KEY_LABEL[key] ?? key`), showing e.g.
  // "tickets_created_by_day" to end users instead of a translated label.
  tickets_created_by_day: "Tickets creados por día",
  sla_compliance_rate: "Cumplimiento de SLA",
};
