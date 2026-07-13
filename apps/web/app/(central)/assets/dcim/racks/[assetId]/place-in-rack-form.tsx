"use client";

import { placeInRackAction } from "@/actions/dcim.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

interface AssetOption {
  id: string;
  name: string;
}

function makeAction(rackAssetId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const unitHeightRaw = formData.get("unitHeight") as string;
      await placeInRackAction({
        rackAssetId,
        occupantAssetId: formData.get("occupantAssetId") as string,
        positionU: Number(formData.get("positionU")),
        unitHeight: unitHeightRaw ? Number(unitHeightRaw) : 1,
        orientation: (formData.get("orientation") as string) || "front",
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function PlaceInRackForm({ rackAssetId, assets }: { rackAssetId: string; assets: AssetOption[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(rackAssetId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Activo</label>
        <select name="occupantAssetId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Selecciona un activo...
          </option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Posición U</label>
          <input name="positionU" type="number" min={1} required className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium">Altura (U)</label>
          <input name="unitHeight" type="number" min={1} defaultValue={1} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Orientación</label>
        <select name="orientation" defaultValue="front" className={inputClass}>
          <option value="front">Frontal</option>
          <option value="rear">Trasera</option>
        </select>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Ubicando..." : "Ubicar en rack"}
      </button>
    </form>
  );
}
