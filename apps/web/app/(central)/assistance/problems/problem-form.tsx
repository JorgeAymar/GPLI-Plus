"use client";

import { createProblemAction } from "@/actions/problems.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createProblemAction({
        entityId,
        title: formData.get("title") as string,
        content: formData.get("content") as string,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ProblemForm({ entityId }: { entityId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Título</label>
        <input name="title" required className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Descripción</label>
        <textarea name="content" required rows={4} className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear problema"}
      </button>
    </form>
  );
}
