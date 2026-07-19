import { listDropdownCategories, listTicketFieldDefinitions } from "@itsm/core";
import { TicketFieldForm } from "./ticket-field-form";

function ticketTypeLabel(ticketType: string | null): string {
  if (ticketType === "incident") return "Incidente";
  if (ticketType === "request") return "Solicitud";
  return "Ambos";
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Campos de ticket" };

export default async function TicketFieldsPage() {
  const [fields, dropdownCategories] = await Promise.all([listTicketFieldDefinitions(), listDropdownCategories()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Campos de ticket</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Campos existentes</h2>
          <ul className="space-y-1">
            {fields.map((f) => (
              <li key={f.id} className="text-sm">
                {f.label}{" "}
                <span className="opacity-40">
                  ({ticketTypeLabel(f.ticketType)}, {f.fieldType}
                  {f.isRequired ? ", requerido" : ""})
                </span>
              </li>
            ))}
            {fields.length === 0 ? <li className="text-sm opacity-50">Sin campos todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo campo</h2>
          <TicketFieldForm dropdownCategories={dropdownCategories} />
        </div>
      </div>
    </div>
  );
}
