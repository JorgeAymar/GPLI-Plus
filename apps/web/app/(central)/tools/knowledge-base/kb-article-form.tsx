"use client";

import { createKbArticleAction } from "@/actions/knowledge-base.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string, authorUserId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createKbArticleAction({
        entityId,
        authorUserId,
        title: formData.get("title") as string,
        body: formData.get("body") as string,
        isFaq: formData.get("isFaq") === "on",
        showInServiceCatalog: formData.get("showInServiceCatalog") === "on",
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function KbArticleForm({ entityId, authorUserId }: { entityId: string; authorUserId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId, authorUserId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="kb-article-title" className="text-sm font-medium">Título</label>
        <input id="kb-article-title" name="title" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="kb-article-body" className="text-sm font-medium">Contenido</label>
        <textarea id="kb-article-body" name="body" required rows={6} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="isFaq" /> Es una pregunta frecuente (FAQ)
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="showInServiceCatalog" /> Mostrar en catálogo de servicios
      </label>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear artículo"}
      </button>
    </form>
  );
}
