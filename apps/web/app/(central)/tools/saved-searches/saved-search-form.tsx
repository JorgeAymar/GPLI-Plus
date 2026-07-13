"use client";

import { createSavedSearchAction } from "@/actions/saved-searches.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

const ITEM_TYPES = [
  { value: "ticket", label: "Tickets" },
  { value: "asset", label: "Activos" },
];

/** v1 simplification: queryJson is a raw JSON textarea (opaque blob, no query-builder UI) - see saved-searches.ts schema doc comment. */
function makeAction(ownerUserId: string, entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const rawQueryJson = (formData.get("queryJson") as string) || "{}";
      let queryJson: Record<string, unknown>;
      try {
        queryJson = JSON.parse(rawQueryJson);
      } catch {
        return { error: "El JSON de criterios no es válido." };
      }

      await createSavedSearchAction({
        name: formData.get("name") as string,
        itemType: formData.get("itemType") as string,
        ownerUserId,
        entityId,
        isPrivate: formData.get("isPrivate") === "on",
        queryJson,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function SavedSearchForm({ ownerUserId, entityId }: { ownerUserId: string; entityId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(ownerUserId, entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="saved-search-name" className="text-sm font-medium">Nombre</label>
        <input id="saved-search-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="saved-search-item-type" className="text-sm font-medium">Tipo de elemento</label>
        <select id="saved-search-item-type" name="itemType" defaultValue="ticket" className={inputClass}>
          {ITEM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input id="isPrivate" name="isPrivate" type="checkbox" defaultChecked />
        <label htmlFor="isPrivate" className="text-sm font-medium">
          Privada (solo yo la veo)
        </label>
      </div>
      <div>
        <label htmlFor="saved-search-query-json" className="text-sm font-medium">Criterios (JSON crudo)</label>
        <textarea id="saved-search-query-json" name="queryJson" rows={4} defaultValue={'{\n  "search": ""\n}'} className={`${inputClass} font-mono text-xs`} />
        <p className="mt-1 text-xs opacity-50">
          v1: sin motor de búsqueda genérico todavía - escribe el JSON de criterios a mano (por ejemplo una clave de texto
          &quot;search&quot;).
        </p>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear búsqueda guardada"}
      </button>
    </form>
  );
}
