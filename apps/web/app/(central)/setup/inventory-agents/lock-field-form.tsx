"use client";

import { lockInventoryFieldAction } from "@/actions/inventory.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(assetId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await lockInventoryFieldAction(assetId, formData.get("fieldName") as string);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function LockFieldForm({ assetId }: { assetId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(assetId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor={`lock-field-name-${assetId}`} className="text-sm font-medium">Nombre del campo (ej. name, serialNumber)</label>
        <input id={`lock-field-name-${assetId}`} name="fieldName" required placeholder="serialNumber" className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Bloqueando..." : "Bloquear campo"}
      </button>
    </form>
  );
}
