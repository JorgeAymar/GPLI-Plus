"use client";

import { addConsumableUnitsAction } from "@/actions/consumables.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(consumableItemId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const quantity = Number(formData.get("quantity"));
      await addConsumableUnitsAction({ consumableItemId, quantity });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function AddUnitsForm({ consumableItemId }: { consumableItemId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(consumableItemId), undefined);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div>
        <label className="text-sm font-medium">Cantidad</label>
        <input
          name="quantity"
          type="number"
          min={1}
          max={1000}
          defaultValue={1}
          required
          className="mt-1 w-24 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "Agregar unidades"}
      </button>
    </form>
  );
}
