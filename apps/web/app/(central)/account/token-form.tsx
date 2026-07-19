"use client";

import { createMyApiClientAction } from "@/actions/account.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
  rawKey?: string;
  clientName?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    const name = formData.get("name") as string;
    const result = await createMyApiClientAction({ name });
    return { rawKey: result.rawKey, clientName: result.client.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function TokenForm() {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <div className="space-y-4">
      {state?.rawKey ? (
        <div className="space-y-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            Token &quot;{state.clientName}&quot; creado. Copiá esta key ahora — no se puede volver a mostrar.
          </p>
          <pre className="overflow-x-auto rounded bg-black/80 p-2 text-xs text-green-400">{state.rawKey}</pre>
        </div>
      ) : null}

      <form action={formAction} className="space-y-3">
        <div>
          <label htmlFor="token-name" className="text-sm font-medium">Nombre</label>
          <input id="token-name" name="name" required placeholder="claude-desktop" className={inputClass} />
        </div>
        {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {isPending ? "Creando..." : "Crear token"}
        </button>
      </form>
    </div>
  );
}
