import { requireAuthContext } from "@/lib/session";
import { STATUS_LABELS, StatusBadge } from "@/components/status-badge";
import {
  countTickets,
  DROPDOWN_CATEGORY,
  getDropdownCategoryByKey,
  listDropdownItems,
  listTicketFieldDefinitions,
  listTickets,
} from "@itsm/core";
import type { DropdownItem, ItilStatus } from "@itsm/db";
import Link from "next/link";
import { TicketForm } from "./ticket-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tickets" };

const PAGE_SIZE = 25;

interface TicketsSearchParams {
  q?: string;
  status?: string;
  page?: string;
}

/** Builds a pagination link that preserves the current search/status filters, only overriding `page`. */
function buildHref(params: TicketsSearchParams, page: number): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  query.set("page", String(page));
  return `/assistance/tickets?${query.toString()}`;
}

export default async function TicketsPage({ searchParams }: { searchParams: Promise<TicketsSearchParams> }) {
  const params = await searchParams;
  const context = await requireAuthContext();

  const parsedPage = Number(params.page);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
  const search = params.q || undefined;
  // Also consumed by /tools/saved-searches' "Usar" link, which links here as `?q=<term>` for
  // ticket-type saved searches - see buildUseHref() in tools/saved-searches/page.tsx.
  const status = params.status && params.status in STATUS_LABELS ? (params.status as ItilStatus) : undefined;

  const [tickets, total, fields] = await Promise.all([
    listTickets(context.activeEntity.id, {
      includeSubtree: true,
      search,
      status,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    countTickets(context.activeEntity.id, { includeSubtree: true, search, status }),
    // Fetch defs for both ticket types - TicketForm filters by the type currently selected client-side.
    listTicketFieldDefinitions(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>

          <form className="mb-3 flex flex-wrap items-end gap-2">
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar por título o descripción..."
              className="w-full max-w-xs rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            >
              <option value="">(todos)</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
              Buscar
            </button>
          </form>

          <ul className="space-y-1">
            {tickets.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <Link href={`/assistance/tickets/${t.id}`} className="text-sm hover:underline">
                  {t.title}
                </Link>
                <StatusBadge status={t.status} />
              </li>
            ))}
            {tickets.length === 0 ? <li className="text-sm opacity-50">Sin tickets todavía.</li> : null}
          </ul>

          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="opacity-70">
              Página {page} de {totalPages} ({total} tickets)
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={buildHref(params, page - 1)} className="rounded-md border border-black/15 px-3 py-1.5 dark:border-white/15">
                  Anterior
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link href={buildHref(params, page + 1)} className="rounded-md border border-black/15 px-3 py-1.5 dark:border-white/15">
                  Siguiente
                </Link>
              ) : null}
            </div>
          </div>
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
