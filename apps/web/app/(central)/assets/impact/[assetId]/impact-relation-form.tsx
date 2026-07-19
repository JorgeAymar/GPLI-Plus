"use client";

import { addImpactRelationAction } from "@/actions/impact.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

interface AssetOption {
  id: string;
  name: string;
}

function makeAction(assetId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const relatedAssetId = formData.get("relatedAssetId") as string;
      const relationDirection = formData.get("relationDirection") as string;
      const label = (formData.get("label") as string) || null;

      // "depende_de": el activo actual depende del seleccionado, es decir el
      // seleccionado impacta al actual (source = seleccionado, impacted = actual).
      // "es_dependencia_de": el activo actual impacta al seleccionado
      // (source = actual, impacted = seleccionado).
      const [sourceAssetId, impactedAssetId] =
        relationDirection === "depende_de" ? [relatedAssetId, assetId] : [assetId, relatedAssetId];

      await addImpactRelationAction({ sourceAssetId, impactedAssetId, label }, assetId);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ImpactRelationForm({ assetId, assets }: { assetId: string; assets: AssetOption[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(assetId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="impact-relation-related-asset" className="text-sm font-medium">Activo relacionado</label>
        <select id="impact-relation-related-asset" name="relatedAssetId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Seleccionar...
          </option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="impact-relation-direction" className="text-sm font-medium">Dirección</label>
        <select id="impact-relation-direction" name="relationDirection" defaultValue="depende_de" className={inputClass}>
          <option value="depende_de">Este activo depende de...</option>
          <option value="es_dependencia_de">Este activo es dependencia de...</option>
        </select>
      </div>
      <div>
        <label htmlFor="impact-relation-label" className="text-sm font-medium">Etiqueta (opcional)</label>
        <input id="impact-relation-label" name="label" className={inputClass} placeholder="ej. conexión de red" />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Agregar relación"}
      </button>
    </form>
  );
}
