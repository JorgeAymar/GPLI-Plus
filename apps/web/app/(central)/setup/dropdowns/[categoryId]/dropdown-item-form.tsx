"use client";

import { createDropdownItemAction } from "@/actions/dropdowns.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(categoryId: string, entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createDropdownItemAction({
        categoryId,
        entityId,
        name: formData.get("name") as string,
        comment: (formData.get("comment") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function DropdownItemForm({ categoryId, entityId }: { categoryId: string; entityId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(categoryId, entityId), undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Nombre</label>
        <input
          name="name"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Comentario</label>
        <textarea
          name="comment"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear item"}
      </button>
    </form>
  );
}
