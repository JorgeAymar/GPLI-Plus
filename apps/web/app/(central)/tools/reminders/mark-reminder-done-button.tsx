"use client";

import { markReminderDoneAction } from "@/actions/reminders.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(id: string) {
  return async (): Promise<FormState> => {
    try {
      await markReminderDoneAction(id);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function MarkReminderDoneButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(id), undefined);

  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={isPending} className="text-xs text-emerald-600 hover:underline disabled:opacity-50">
        {isPending ? "..." : "Marcar hecho"}
      </button>
      {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
