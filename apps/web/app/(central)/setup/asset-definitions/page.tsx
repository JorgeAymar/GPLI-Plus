import Link from "next/link";
import { listAssetDefinitions } from "@itsm/core";
import { AssetDefinitionForm } from "./asset-definition-form";

export default async function AssetDefinitionsPage() {
  const definitions = await listAssetDefinitions();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tipos de activo</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Tipos existentes</h2>
          <ul className="space-y-1">
            {definitions.map((d) => (
              <li key={d.id}>
                <Link href={`/setup/asset-definitions/${d.id}`} className="text-sm hover:underline">
                  {d.name} <span className="opacity-40">({d.key})</span>
                  {d.isSystem ? <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">core</span> : null}
                </Link>
              </li>
            ))}
            {definitions.length === 0 ? <li className="text-sm opacity-50">Sin tipos todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo tipo de activo</h2>
          <AssetDefinitionForm />
        </div>
      </div>
    </div>
  );
}
