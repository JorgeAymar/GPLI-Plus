"use client";

import { createChangeAction } from "@/actions/changes.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const plannedStartAt = formData.get("plannedStartAt") as string;
      const plannedEndAt = formData.get("plannedEndAt") as string;
      await createChangeAction({
        entityId,
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        plannedStartAt: plannedStartAt || null,
        plannedEndAt: plannedEndAt || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ChangeForm({ entityId }: { entityId: string }) {
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Inicio planificado</label>
          <input name="plannedStartAt" type="datetime-local" className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium">Fin planificado</label>
          <input name="plannedEndAt" type="datetime-local" className={inputClass} />
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear cambio"}
      </button>
    </form>
  );
}
