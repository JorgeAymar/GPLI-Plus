"use client";

import { createSlaPolicyAction } from "@/actions/sla-policies.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const ttoRaw = formData.get("ttoMinutes") as string;
      const ttrRaw = formData.get("ttrMinutes") as string;
      await createSlaPolicyAction({
        entityId,
        name: formData.get("name") as string,
        ttoMinutes: ttoRaw ? Number(ttoRaw) : null,
        ttrMinutes: ttrRaw ? Number(ttrRaw) : null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function SlaPolicyForm({ entityId }: { entityId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Nombre</label>
        <input name="name" required placeholder="Estándar 24/7" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Tiempo de primera respuesta (min.)</label>
          <input name="ttoMinutes" type="number" min={1} placeholder="60" className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium">Tiempo de resolución (min.)</label>
          <input name="ttrMinutes" type="number" min={1} placeholder="1440" className={inputClass} />
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear política SLA"}
      </button>
    </form>
  );
}
