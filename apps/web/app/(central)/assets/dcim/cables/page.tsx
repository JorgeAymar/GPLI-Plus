import { requireAuthContext } from "@/lib/session";
import { DROPDOWN_CATEGORY, getDropdownCategoryByKey, listAssets, listCables, listDropdownItems } from "@itsm/core";
import { CableForm } from "./cable-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cables" };

export default async function CablesPage() {
  const context = await requireAuthContext();

  const [cables, allAssets, cableTypeCategory] = await Promise.all([
    listCables(),
    listAssets(context.activeEntity.id, { includeSubtree: true }),
    getDropdownCategoryByKey(DROPDOWN_CATEGORY.CABLE_TYPE),
  ]);

  const assetById = new Map(allAssets.map((a) => [a.id, a]));
  const cableTypes = cableTypeCategory ? await listDropdownItems(cableTypeCategory.id, context.activeEntity.id) : [];
  const cableTypeById = new Map(cableTypes.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Cables</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Existentes</h2>
          <ul className="space-y-1">
            {cables.map((c) => (
              <li key={c.id} className="text-sm">
                {c.name ?? "(sin nombre)"}{" "}
                <span className="opacity-40">
                  ({assetById.get(c.endpointAAssetId)?.name ?? c.endpointAAssetId} ↔{" "}
                  {assetById.get(c.endpointBAssetId)?.name ?? c.endpointBAssetId})
                  {c.cableTypeDropdownItemId ? `, ${cableTypeById.get(c.cableTypeDropdownItemId)?.name ?? "?"}` : ""}
                </span>
              </li>
            ))}
            {cables.length === 0 ? <li className="text-sm opacity-50">Sin cables todavía.</li> : null}
          </ul>
        </div>
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-medium opacity-60 dark:border-white/10">Nuevo cable</h2>
          <CableForm
            assets={allAssets.map((a) => ({ id: a.id, name: a.name }))}
            cableTypes={cableTypes.map((t) => ({ id: t.id, name: t.name }))}
          />
        </div>
      </div>
    </div>
  );
}
