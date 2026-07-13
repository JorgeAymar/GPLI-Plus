"use client";

import { createRssFeedAction } from "@/actions/rss-feeds.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(ownerUserId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const refreshRateMinutes = formData.get("refreshRateMinutes") as string;
      const maxItems = formData.get("maxItems") as string;
      await createRssFeedAction({
        name: formData.get("name") as string,
        ownerUserId,
        url: formData.get("url") as string,
        refreshRateMinutes: refreshRateMinutes ? Number(refreshRateMinutes) : undefined,
        maxItems: maxItems ? Number(maxItems) : undefined,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function RssFeedForm({ ownerUserId }: { ownerUserId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(ownerUserId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Nombre</label>
        <input name="name" required className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">URL del feed</label>
        <input name="url" type="url" required placeholder="https://ejemplo.com/feed.xml" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Actualizar cada (min)</label>
          <input name="refreshRateMinutes" type="number" min={1} defaultValue={1440} className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium">Máx. items</label>
          <input name="maxItems" type="number" min={1} max={100} defaultValue={20} className={inputClass} />
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear feed"}
      </button>
    </form>
  );
}
