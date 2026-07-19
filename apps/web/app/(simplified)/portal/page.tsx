import { requireAuthContext } from "@/lib/session";
import { listServiceCatalogItems, listTicketsForRequester } from "@itsm/core";
import Link from "next/link";
import { PortalTicketForm } from "./portal-ticket-form";

const STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  assigned: "Asignado",
  planned: "Planificado",
  pending: "Pendiente",
  solved: "Resuelto",
  closed: "Cerrado",
};

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Portal de autoservicio" };

export default async function PortalPage() {
  const context = await requireAuthContext();
  const myTickets = await listTicketsForRequester(context.user.id);
  // Active only (listServiceCatalogItems default) - end users should never see a disabled entry.
  const catalogItems = await listServiceCatalogItems(context.activeEntity.id, { includeSubtree: true });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">¿En qué te podemos ayudar?</h1>

        <div className="mt-4">
          <h2 className="mb-2 text-sm font-medium opacity-70">Catálogo de servicios</h2>
          <ul className="space-y-1">
            {catalogItems.map((item) => (
              <li key={item.id} className="text-sm">
                {/* serviceCatalogItemId is not read by PortalTicketForm yet - reserved for a future
                    enhancement where the form precharges ticketType/categoryDropdownItemId from it. */}
                <Link href={`/portal?serviceCatalogItemId=${item.id}`} className="underline underline-offset-2">
                  {item.name}
                </Link>
              </li>
            ))}
            {catalogItems.length === 0 ? <li className="text-sm opacity-50">Sin tipos de solicitud predefinidos todavía.</li> : null}
          </ul>
        </div>

        <div className="mt-4 max-w-md">
          <PortalTicketForm entityId={context.activeEntity.id} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Mis solicitudes</h2>
        <ul className="space-y-1">
          {myTickets.map((t) => (
            <li key={t.id} className="text-sm">
              {t.title} <span className="opacity-40">({STATUS_LABELS[t.status] ?? t.status})</span>
            </li>
          ))}
          {myTickets.length === 0 ? <li className="text-sm opacity-50">Sin solicitudes todavía.</li> : null}
        </ul>
      </div>
    </div>
  );
}
