"use client";

import { createBudgetAction } from "@/actions/budgets.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const amount = Number(formData.get("amount") || 0);
      await createBudgetAction({
        entityId,
        name: formData.get("name") as string,
        amountCents: Math.round(amount * 100),
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function BudgetForm({ entityId }: { entityId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="budget-name" className="text-sm font-medium">Nombre</label>
        <input id="budget-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="budget-amount" className="text-sm font-medium">Monto</label>
        <input id="budget-amount" name="amount" type="number" step="0.01" min="0" required className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear presupuesto"}
      </button>
    </form>
  );
}
