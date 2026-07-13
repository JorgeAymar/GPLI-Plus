import { requireAuthContext } from "@/lib/session";
import { getAsset, listAssets, listRackSlots } from "@itsm/core";
import { notFound } from "next/navigation";
import { PlaceInRackForm } from "./place-in-rack-form";
import { RemoveFromRackButton } from "./remove-from-rack-button";

// Sensible default for display purposes only (e.g. "slots used of a suggested N") -
// racks have no stored height field in this slice, so this is not enforced, only shown.
const SUGGESTED_RACK_HEIGHT_U = 42;

export default async function RackDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const context = await requireAuthContext();

  const rack = await getAsset(assetId);
  if (!rack) notFound();

  const [slots, allAssets] = await Promise.all([
    listRackSlots(assetId),
    listAssets(context.activeEntity.id, { includeSubtree: true }),
  ]);

  const assetById = new Map(allAssets.map((a) => [a.id, a]));
  // Assets available to place: exclude the rack itself and anything already occupying a slot in this rack.
  const occupiedIds = new Set(slots.map((s) => s.occupantAssetId).filter((id): id is string => id !== null));
  const placeableAssets = allAssets.filter((a) => a.id !== assetId && !occupiedIds.has(a.id));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{rack.name}</h1>
      <p className="text-sm opacity-60">
        Rack · {slots.length} posición(es) ocupada(s) (altura sugerida: {SUGGESTED_RACK_HEIGHT_U}U)
      </p>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Posiciones ocupadas</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-60">
                <th className="pb-2">U</th>
                <th className="pb-2">Altura</th>
                <th className="pb-2">Orientación</th>
                <th className="pb-2">Ocupante</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id} className="border-t border-black/5 dark:border-white/5">
                  <td className="py-2">{slot.positionU}</td>
                  <td className="py-2 opacity-70">{slot.unitHeight}</td>
                  <td className="py-2 opacity-70">{slot.orientation}</td>
                  <td className="py-2 opacity-70">
                    {slot.occupantAssetId ? (assetById.get(slot.occupantAssetId)?.name ?? slot.occupantAssetId) : "-"}
                  </td>
                  <td className="py-2">
                    <RemoveFromRackButton id={slot.id} rackAssetId={assetId} />
                  </td>
                </tr>
              ))}
              {slots.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-2 opacity-50">
                    Sin posiciones ocupadas todavía.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Ubicar un activo</h2>
          <PlaceInRackForm rackAssetId={assetId} assets={placeableAssets.map((a) => ({ id: a.id, name: a.name }))} />
        </div>
      </div>
    </div>
  );
}
