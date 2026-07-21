"use client";

import { createDashboardAction } from "@/actions/dashboards.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const result = await createDashboardAction({
    key: formData.get("key") as string,
    name: formData.get("name") as string,
  });
  return result.error ? { error: result.error } : {};
}

export function DashboardForm() {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="dashboard-name" className="text-sm font-medium">Nombre</label>
        <input id="dashboard-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="dashboard-key" className="text-sm font-medium">Clave</label>
        <input id="dashboard-key" name="key" required className={inputClass} placeholder="ej. panel-operaciones" />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear dashboard"}
      </button>
    </form>
  );
}
