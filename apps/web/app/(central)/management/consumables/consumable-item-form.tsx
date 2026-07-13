"use client";

import { createConsumableItemAction } from "@/actions/consumables.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const supplierId = formData.get("supplierId") as string;
      const alertThreshold = formData.get("alertThreshold") as string;
      await createConsumableItemAction({
        entityId,
        name: formData.get("name") as string,
        supplierId: supplierId || null,
        alertThreshold: alertThreshold ? Number(alertThreshold) : null,
        comment: (formData.get("comment") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ConsumableItemForm({ entityId, suppliers }: { entityId: string; suppliers: SupplierOption[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Nombre</label>
        <input name="name" required className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Proveedor</label>
        <select name="supplierId" defaultValue="" className={inputClass}>
          <option value="">Ninguno</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Umbral de alerta (stock bajo)</label>
        <input name="alertThreshold" type="number" min={0} className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Comentario</label>
        <textarea name="comment" className={inputClass} rows={2} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear consumible"}
      </button>
    </form>
  );
}
