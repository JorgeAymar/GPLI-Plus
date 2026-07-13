"use client";

import { createApiClientAction } from "@/actions/api-clients.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
  rawKey?: string;
  clientName?: string;
}

function makeAction(entityId: string) {
  return async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
    try {
      const name = formData.get("name") as string;
      const scopes = formData.getAll("scopes").map(String);
      const result = await createApiClientAction({ entityId, name, scopes });
      return { rawKey: result.rawKey, clientName: result.client.name };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ApiClientForm({ entityId, scopeOptions }: { entityId: string; scopeOptions: string[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <div className="space-y-4">
      {state?.rawKey ? (
        <div className="space-y-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            Cliente &quot;{state.clientName}&quot; creado. Copiá esta API key ahora — no se puede volver a mostrar.
          </p>
          <pre className="overflow-x-auto rounded bg-black/80 p-2 text-xs text-green-400">{state.rawKey}</pre>
        </div>
      ) : null}

      <form action={formAction} className="space-y-3">
        <div>
          <label htmlFor="api-client-name" className="text-sm font-medium">Nombre</label>
          <input id="api-client-name" name="name" required placeholder="Script de integración X" className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium">Scopes (módulos permitidos)</label>
          <div className="mt-1 grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-black/15 p-2 text-sm dark:border-white/15">
            {scopeOptions.map((scope) => (
              <label key={scope} className="flex items-center gap-2">
                <input type="checkbox" name="scopes" value={scope} className="rounded" />
                {scope}
              </label>
            ))}
          </div>
        </div>
        {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {isPending ? "Creando..." : "Crear cliente API"}
        </button>
      </form>
    </div>
  );
}
