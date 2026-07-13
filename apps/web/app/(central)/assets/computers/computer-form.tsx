"use client";

import { createComputerAction } from "@/actions/computers.actions";
import type { DropdownItem } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createComputerAction({
        entityId,
        name: formData.get("name") as string,
        serialNumber: (formData.get("serialNumber") as string) || null,
        inventoryNumber: (formData.get("inventoryNumber") as string) || null,
        osDropdownItemId: (formData.get("osDropdownItemId") as string) || null,
        domain: (formData.get("domain") as string) || null,
        comment: (formData.get("comment") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ComputerForm({ entityId, osOptions }: { entityId: string; osOptions: DropdownItem[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="computer-name" className="text-sm font-medium">Nombre</label>
        <input id="computer-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="computer-serial-number" className="text-sm font-medium">Número de serie</label>
        <input id="computer-serial-number" name="serialNumber" className={inputClass} />
      </div>
      <div>
        <label htmlFor="computer-inventory-number" className="text-sm font-medium">Número de inventario</label>
        <input id="computer-inventory-number" name="inventoryNumber" className={inputClass} />
      </div>
      <div>
        <label htmlFor="computer-os" className="text-sm font-medium">Sistema operativo</label>
        <select id="computer-os" name="osDropdownItemId" className={inputClass}>
          <option value="">(ninguno)</option>
          {osOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="computer-domain" className="text-sm font-medium">Dominio</label>
        <input id="computer-domain" name="domain" className={inputClass} />
      </div>
      <div>
        <label htmlFor="computer-comment" className="text-sm font-medium">Comentario</label>
        <textarea id="computer-comment" name="comment" className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear computadora"}
      </button>
    </form>
  );
}
