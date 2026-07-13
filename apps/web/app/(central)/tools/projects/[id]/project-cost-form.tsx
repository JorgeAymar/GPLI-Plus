"use client";

import { addProjectCostAction } from "@/actions/projects.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(projectId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const amount = Number(formData.get("amount") || 0);
      await addProjectCostAction({
        projectId,
        amountCents: Math.round(amount * 100),
        comment: (formData.get("comment") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ProjectCostForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(projectId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Monto</label>
        <input name="amount" type="number" step="0.01" min="0" required className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Comentario</label>
        <input name="comment" className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "Agregar costo"}
      </button>
    </form>
  );
}
