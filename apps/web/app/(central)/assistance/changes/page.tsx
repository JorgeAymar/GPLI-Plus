import { requireAuthContext } from "@/lib/session";
import { StatusBadge } from "@/components/status-badge";
import { DROPDOWN_CATEGORY, getDropdownCategoryByKey, listChanges, listDropdownItems } from "@itsm/core";
import Link from "next/link";
import { ChangeForm } from "./change-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cambios" };

export default async function ChangesPage() {
  const context = await requireAuthContext();
  const changes = await listChanges(context.activeEntity.id, { includeSubtree: true });

  // ITIL_CATEGORY is the shared category dropdown for tickets/problems/changes (see seed.ts).
  const categoryCategory = await getDropdownCategoryByKey(DROPDOWN_CATEGORY.ITIL_CATEGORY);
  const categoryOptions = categoryCategory ? await listDropdownItems(categoryCategory.id, context.activeEntity.id) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Cambios</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Existentes</h2>
          <ul className="space-y-1">
            {changes.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Link href={`/assistance/changes/${c.id}`} className="text-sm hover:underline">
                  {c.title}
                </Link>
                <StatusBadge status={c.status} />
              </li>
            ))}
            {changes.length === 0 ? <li className="text-sm opacity-50">Sin cambios todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-60">Nuevo cambio</h2>
          <ChangeForm entityId={context.activeEntity.id} categoryOptions={categoryOptions} />
        </div>
      </div>
    </div>
  );
}
