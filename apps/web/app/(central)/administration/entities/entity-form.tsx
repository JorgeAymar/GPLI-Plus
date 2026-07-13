"use client";

import { createEntityAction } from "@/actions/entities.actions";
import type { Entity } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    await createEntityAction({
      name: formData.get("name") as string,
      parentId: (formData.get("parentId") as string) || null,
      comment: (formData.get("comment") as string) || null,
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function EntityForm({ entities }: { entities: Entity[] }) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="entity-name" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="entity-name"
          name="name"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="entity-parentId" className="text-sm font-medium">
          Entidad padre
        </label>
        <select
          id="entity-parentId"
          name="parentId"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          <option value="">(raíz)</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="entity-comment" className="text-sm font-medium">
          Comentario
        </label>
        <textarea
          id="entity-comment"
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
        {isPending ? "Creando..." : "Crear entidad"}
      </button>
    </form>
  );
}
