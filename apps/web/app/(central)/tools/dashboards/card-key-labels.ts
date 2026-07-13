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
};
