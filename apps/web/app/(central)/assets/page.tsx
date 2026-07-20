import { requireAuthContext } from "@/lib/session";
import { listAssetDefinitions, listAssets } from "@itsm/core";
import Link from "next/link";

// Types with their own extension table get a dedicated static route; every
// other type (generic or custom) falls back to the dynamic /assets/[assetType] route.
const DEDICATED_ROUTES: Record<string, string> = {
  computer: "/assets/computers",
  network_equipment: "/assets/network-equipment",
};

function assetTypeHref(key: string): string {
  return DEDICATED_ROUTES[key] ?? `/assets/${key}`;
}

// Individual asset instance detail page: dedicated types resolve to their static
// /[id] route (e.g. /assets/computers/<id>), everything else to the dynamic
// /assets/[assetType]/[id] route.
function assetDetailHref(key: string, id: string): string {
  const dedicated = DEDICATED_ROUTES[key];
  return dedicated ? `${dedicated}/${id}` : `/assets/${key}/${id}`;
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Todos los activos" };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const context = await requireAuthContext();

  const [assets, definitions] = await Promise.all([
    listAssets(context.activeEntity.id, { search: q, includeSubtree: true }),
    listAssetDefinitions(),
  ]);
  const definitionById = new Map(definitions.map((d) => [d.id, d]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Todos los activos</h1>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre, serie o inventario..."
          className="w-full max-w-md rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
        <button type="submit" className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          Buscar
        </button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-60">
            <th className="pb-2">Nombre</th>
            <th className="pb-2">Tipo</th>
            <th className="pb-2">Serie</th>
            <th className="pb-2">Inventario</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => {
            const definition = definitionById.get(a.assetDefinitionId);
            return (
              <tr key={a.id} className="border-t border-black/5 dark:border-white/5">
                <td className="py-2">
                  {definition ? (
                    <Link href={assetDetailHref(definition.key, a.id)} className="hover:underline">
                      {a.name}
                    </Link>
                  ) : (
                    a.name
                  )}
                </td>
                <td className="py-2 opacity-70">{definition?.name ?? "?"}</td>
                <td className="py-2 opacity-70">{a.serialNumber ?? "-"}</td>
                <td className="py-2 opacity-70">{a.inventoryNumber ?? "-"}</td>
              </tr>
            );
          })}
          {assets.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-2 opacity-50">
                Sin activos todavía.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Ir a un tipo específico</h2>
        <div className="flex flex-col gap-1">
          {definitions.map((d) => (
            <Link key={d.id} href={assetTypeHref(d.key)} className="text-sm underline opacity-70 hover:opacity-100">
              {d.name} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
