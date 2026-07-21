import { requireAuthContext } from "@/lib/session";
import { listSavedSearches } from "@itsm/core";
import Link from "next/link";
import { SavedSearchForm } from "./saved-search-form";

/**
 * v1 simplification: this system has no generic search engine, so "running" a
 * saved search means jumping to the matching item-type list page with its
 * `queryJson.search` (if any) pre-loaded as a `?q=` param, instead of
 * re-executing a structured query server-side - see the doc comment on
 * `savedSearches` in packages/db/src/schema/saved-searches.ts.
 */
const ITEM_TYPE_BASE_PATH: Record<string, string> = {
  ticket: "/assistance/tickets",
  asset: "/assets",
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  ticket: "Ticket",
  asset: "Activo",
};

function buildUseHref(itemType: string, queryJson: unknown): string {
  const basePath = ITEM_TYPE_BASE_PATH[itemType] ?? "/";
  const query = queryJson && typeof queryJson === "object" ? (queryJson as Record<string, unknown>) : null;
  const search = query && typeof query.search === "string" ? query.search : undefined;
  return search ? `${basePath}?q=${encodeURIComponent(search)}` : basePath;
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Búsquedas guardadas" };

export default async function SavedSearchesPage() {
  const context = await requireAuthContext();
  const savedSearchList = await listSavedSearches(context.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Búsquedas guardadas</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Guardadas</h2>
          <ul className="space-y-1">
            {savedSearchList.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {s.name} <span className="opacity-40">({ITEM_TYPE_LABEL[s.itemType] ?? s.itemType})</span>
                  {s.isPrivate ? null : (
                    <span className="ml-2 rounded-md border border-black/15 px-2 py-0.5 text-xs dark:border-white/15">
                      compartida
                    </span>
                  )}
                </span>
                <Link
                  href={buildUseHref(s.itemType, s.queryJson)}
                  className="rounded-md border border-black/15 px-2 py-1 text-xs dark:border-white/15"
                >
                  Usar
                </Link>
              </li>
            ))}
            {savedSearchList.length === 0 ? <li className="text-sm opacity-50">Sin búsquedas guardadas todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-60">Nueva búsqueda guardada</h2>
          <SavedSearchForm ownerUserId={context.user.id} entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}
