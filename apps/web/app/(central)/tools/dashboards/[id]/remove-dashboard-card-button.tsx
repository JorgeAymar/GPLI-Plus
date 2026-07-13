"use client";

import { removeDashboardCardAction } from "@/actions/dashboards.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(id: string, dashboardId: string) {
  return async (): Promise<FormState> => {
    try {
      await removeDashboardCardAction(id, dashboardId);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function RemoveDashboardCardButton({ id, dashboardId }: { id: string; dashboardId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(id, dashboardId), undefined);

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {isPending ? "..." : "Eliminar"}
      </button>
      {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
