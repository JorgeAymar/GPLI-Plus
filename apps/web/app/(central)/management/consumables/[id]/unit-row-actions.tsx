"use client";

import { retireConsumableAction, useConsumableAction } from "@/actions/consumables.actions";
import type { Asset } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeUseAction(consumableId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await useConsumableAction({ id: consumableId, assignedAssetId: formData.get("assignedAssetId") as string });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function UseConsumableForm({ consumableId, assets }: { consumableId: string; assets: Asset[] }) {
  const [state, formAction, isPending] = useActionState(makeUseAction(consumableId), undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        name="assignedAssetId"
        aria-label="Activo a asignar"
        required
        className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/15"
      >
        <option value="">Selecciona un activo</option>
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      {state?.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
      <button
        type="submit"
        disabled={isPending || assets.length === 0}
        className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "..." : "Usar"}
      </button>
    </form>
  );
}

function makeRetireAction(consumableItemId: string, consumableId: string) {
  return async (): Promise<FormState> => {
    try {
      await retireConsumableAction(consumableItemId, consumableId);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function RetireConsumableForm({ consumableItemId, consumableId }: { consumableItemId: string; consumableId: string }) {
  const [state, formAction, isPending] = useActionState(makeRetireAction(consumableItemId, consumableId), undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      {state?.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium disabled:opacity-50 dark:border-white/15"
      >
        {isPending ? "..." : "Retirar"}
      </button>
    </form>
  );
}
