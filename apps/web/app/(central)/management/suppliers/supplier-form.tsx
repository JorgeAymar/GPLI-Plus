"use client";

import { createSupplierAction } from "@/actions/suppliers.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createSupplierAction({
        entityId,
        name: formData.get("name") as string,
        phone: (formData.get("phone") as string) || null,
        email: (formData.get("email") as string) || null,
        website: (formData.get("website") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function SupplierForm({ entityId }: { entityId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="supplier-name" className="text-sm font-medium">Nombre</label>
        <input id="supplier-name" name="name" required className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="supplier-phone" className="text-sm font-medium">Teléfono</label>
          <input id="supplier-phone" name="phone" className={inputClass} />
        </div>
        <div>
          <label htmlFor="supplier-email" className="text-sm font-medium">Email</label>
          <input id="supplier-email" name="email" type="email" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="supplier-website" className="text-sm font-medium">Sitio web</label>
        <input id="supplier-website" name="website" className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear proveedor"}
      </button>
    </form>
  );
}
