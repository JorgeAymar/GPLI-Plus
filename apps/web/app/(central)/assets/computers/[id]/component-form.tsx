"use client";

import { addAssetComponentAction } from "@/actions/computers.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

const COMPONENT_TYPES = ["cpu", "ram", "disk", "gpu", "psu", "motherboard", "nic", "other"] as const;

function makeAction(assetId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const capacityValueRaw = formData.get("capacityValue") as string;
      await addAssetComponentAction({
        assetId,
        componentType: formData.get("componentType") as (typeof COMPONENT_TYPES)[number],
        name: formData.get("name") as string,
        quantity: Number(formData.get("quantity") || 1),
        capacityValue: capacityValueRaw ? Number(capacityValueRaw) : null,
        capacityUnit: (formData.get("capacityUnit") as string) || null,
        serialNumber: (formData.get("serialNumber") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ComponentForm({ assetId }: { assetId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(assetId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="component-type" className="text-sm font-medium">Tipo</label>
        <select id="component-type" name="componentType" className={inputClass}>
          {COMPONENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="component-name" className="text-sm font-medium">Nombre</label>
        <input id="component-name" name="name" required placeholder="Intel Core i7-12700K" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="component-quantity" className="text-sm font-medium">Cantidad</label>
          <input id="component-quantity" name="quantity" type="number" defaultValue={1} min={1} className={inputClass} />
        </div>
        <div>
          <label htmlFor="component-capacity-value" className="text-sm font-medium">Capacidad</label>
          <input id="component-capacity-value" name="capacityValue" type="number" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="component-capacity-unit" className="text-sm font-medium">Unidad de capacidad</label>
        <input id="component-capacity-unit" name="capacityUnit" placeholder="GB" className={inputClass} />
      </div>
      <div>
        <label htmlFor="component-serial-number" className="text-sm font-medium">Número de serie</label>
        <input id="component-serial-number" name="serialNumber" className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "Agregar componente"}
      </button>
    </form>
  );
}
