import { requireAuthContext } from "@/lib/session";
import { getAssetDefinitionByKey, listAssets } from "@itsm/core";
import Link from "next/link";

export default async function DcimIndexPage() {
  const context = await requireAuthContext();
  const rackDefinition = await getAssetDefinitionByKey("rack");
  const racks = rackDefinition
    ? await listAssets(context.activeEntity.id, { assetDefinitionId: rackDefinition.id, includeSubtree: true })
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">DCIM</h1>
      <p className="text-sm opacity-70">Gestión de infraestructura de datacenter: racks, chasis, PDUs, clusters y cables.</p>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Racks</h2>
        {rackDefinition ? (
          <>
            <ul className="mb-2 space-y-1">
              {racks.map((rack) => (
                <li key={rack.id} className="text-sm">
                  <Link href={`/assets/dcim/racks/${rack.id}`} className="underline">
                    {rack.name}
                  </Link>
                </li>
              ))}
              {racks.length === 0 ? <li className="text-sm opacity-50">Sin racks todavía.</li> : null}
            </ul>
            <Link href="/assets/rack" className="text-sm underline opacity-70">
              + Crear un rack nuevo
            </Link>
          </>
        ) : (
          <p className="text-sm opacity-50">
            El tipo de activo &quot;rack&quot; todavía no existe. Ejecuta el seed o créalo en Configuración → Tipos de activo.
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Cables</h2>
        <Link href="/assets/dcim/cables" className="text-sm underline">
          Ver todos los cables
        </Link>
      </div>
    </div>
  );
}
