"use client";

import { acceptUnmanagedAction } from "@/actions/inventory.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(submissionId: string) {
  return async (): Promise<FormState> => {
    try {
      await acceptUnmanagedAction(submissionId);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function AcceptUnmanagedButton({ submissionId }: { submissionId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(submissionId), undefined);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-black/15 px-2 py-0.5 text-xs font-medium disabled:opacity-50 dark:border-white/15"
      >
        {isPending ? "Aceptando..." : "Aceptar como Unmanaged Device"}
      </button>
      {state?.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}
