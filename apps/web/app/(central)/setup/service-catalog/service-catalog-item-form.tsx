"use client";

import { createServiceCatalogItemAction } from "@/actions/service-catalog.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const sortOrderRaw = formData.get("sortOrder") as string;
      await createServiceCatalogItemAction({
        entityId,
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || null,
        ticketType: formData.get("ticketType") as string,
        sortOrder: sortOrderRaw ? Number(sortOrderRaw) : undefined,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ServiceCatalogItemForm({ entityId }: { entityId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Nombre</label>
        <input name="name" required placeholder="Ej: Restablecer contraseña" className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Descripción</label>
        <textarea name="description" rows={3} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Tipo de solicitud</label>
          <select name="ticketType" defaultValue="request" className={inputClass}>
            <option value="request">Solicitud</option>
            <option value="incident">Incidente</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Orden</label>
          <input name="sortOrder" type="number" defaultValue={0} className={inputClass} />
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear tipo de solicitud"}
      </button>
    </form>
  );
}
