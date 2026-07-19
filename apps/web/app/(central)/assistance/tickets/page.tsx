import { requireAuthContext } from "@/lib/session";
import { DROPDOWN_CATEGORY, getDropdownCategoryByKey, listDropdownItems, listTicketFieldDefinitions, listTickets } from "@itsm/core";
import type { DropdownItem } from "@itsm/db";
import Link from "next/link";
import { TicketForm } from "./ticket-form";

const STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  assigned: "Asignado",
  planned: "Planificado",
  pending: "Pendiente",
  solved: "Resuelto",
  closed: "Cerrado",
};

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tickets" };

export default async function TicketsPage() {
  const context = await requireAuthContext();
  const [tickets, fields] = await Promise.all([
    listTickets(context.activeEntity.id, { includeSubtree: true }),
    // Fetch defs for both ticket types - TicketForm filters by the type currently selected client-side.
    listTicketFieldDefinitions(),
  ]);

  const dropdownOptions: Record<string, DropdownItem[]> = {};
  for (const field of fields) {
    if (field.fieldType === "dropdown" && field.dropdownCategoryId) {
      dropdownOptions[field.key] = await listDropdownItems(field.dropdownCategoryId, context.activeEntity.id);
    }
  }

  // itil_category is the shared category dropdown for tickets/problems/changes (see seed.ts).
  const categoryCategory = await getDropdownCategoryByKey(DROPDOWN_CATEGORY.ITIL_CATEGORY);
  const categoryOptions = categoryCategory ? await listDropdownItems(categoryCategory.id, context.activeEntity.id) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tickets</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/assistance/tickets/${t.id}`} className="text-sm hover:underline">
                  {t.title} <span className="opacity-40">({STATUS_LABELS[t.status] ?? t.status})</span>
                </Link>
              </li>
            ))}
            {tickets.length === 0 ? <li className="text-sm opacity-50">Sin tickets todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo ticket</h2>
          <TicketForm
            entityId={context.activeEntity.id}
            fields={fields}
            dropdownOptions={dropdownOptions}
            categoryOptions={categoryOptions}
          />
        </div>
      </div>
    </div>
  );
}
