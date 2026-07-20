import { requireAuthContext } from "@/lib/session";
import { listServiceCatalogItems } from "@itsm/core";
import { ServiceCatalogItemForm } from "./service-catalog-item-form";

const TICKET_TYPE_LABELS: Record<string, string> = {
  incident: "Incidente",
  request: "Solicitud",
};

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Catálogo de servicios" };

export default async function ServiceCatalogPage() {
  const context = await requireAuthContext();
  // onlyActive: false - this is the admin management screen, so disabled
  // items must stay visible (with a marker) instead of disappearing, or
  // there would be no way to find and re-enable them.
  const items = await listServiceCatalogItems(context.activeEntity.id, { includeSubtree: true, onlyActive: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Catálogo de servicios</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id} className="text-sm">
                {item.name}{" "}
                <span className="opacity-40">
                  ({TICKET_TYPE_LABELS[item.ticketType] ?? item.ticketType}
                  {item.isActive ? "" : ", inactivo"})
                </span>
              </li>
            ))}
            {items.length === 0 ? <li className="text-sm opacity-50">Sin tipos de solicitud todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo tipo de solicitud</h2>
          <ServiceCatalogItemForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}
