"use client";

import { addCostAction } from "@/actions/itil-shared.actions";
import type { ItilType } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(itilType: ItilType, itilId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const amount = Number(formData.get("amount") || 0);
      await addCostAction({
        itilType,
        itilId,
        costType: formData.get("costType") as string,
        amountCents: Math.round(amount * 100),
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function CostForm({ itilType, itilId }: { itilType: ItilType; itilId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(itilType, itilId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div>
        <label htmlFor="itil-cost-type" className="text-sm font-medium">Tipo</label>
        <input id="itil-cost-type" name="costType" required placeholder="Mano de obra" className={inputClass} />
      </div>
      <div>
        <label htmlFor="itil-cost-amount" className="text-sm font-medium">Monto</label>
        <input id="itil-cost-amount" name="amount" type="number" step="0.01" min="0" required className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "..." : "Agregar"}
      </button>
    </form>
  );
}
