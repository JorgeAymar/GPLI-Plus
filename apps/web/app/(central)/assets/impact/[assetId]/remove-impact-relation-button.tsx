"use client";

import { removeImpactRelationAction } from "@/actions/impact.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(id: string, viewAssetId: string) {
  return async (): Promise<FormState> => {
    try {
      await removeImpactRelationAction(id, viewAssetId);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function RemoveImpactRelationButton({ id, viewAssetId }: { id: string; viewAssetId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(id, viewAssetId), undefined);

  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {isPending ? "..." : "Quitar"}
      </button>
      {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
