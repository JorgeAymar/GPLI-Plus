import { requireAuthContext } from "@/lib/session";
import { getDropdownCategoryByKey, listChanges, listDropdownItems } from "@itsm/core";
import Link from "next/link";
import { ChangeForm } from "./change-form";

export default async function ChangesPage() {
  const context = await requireAuthContext();
  const changes = await listChanges(context.activeEntity.id, { includeSubtree: true });

  // itil_category is the shared category dropdown for tickets/problems/changes (see seed.ts).
  const categoryCategory = await getDropdownCategoryByKey("itil_category");
  const categoryOptions = categoryCategory ? await listDropdownItems(categoryCategory.id, context.activeEntity.id) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Cambios</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {changes.map((c) => (
              <li key={c.id}>
                <Link href={`/assistance/changes/${c.id}`} className="text-sm hover:underline">
                  {c.title} <span className="opacity-40">({c.status})</span>
                </Link>
              </li>
            ))}
            {changes.length === 0 ? <li className="text-sm opacity-50">Sin cambios todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo cambio</h2>
          <ChangeForm entityId={context.activeEntity.id} categoryOptions={categoryOptions} />
        </div>
      </div>
    </div>
  );
}
