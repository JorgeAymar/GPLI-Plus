"use client";

import { createDropdownCategoryAction } from "@/actions/dropdowns.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    await createDropdownCategoryAction({
      key: formData.get("key") as string,
      name: formData.get("name") as string,
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function DropdownCategoryForm() {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="dropdown-category-key" className="text-sm font-medium">Clave (key)</label>
        <input
          id="dropdown-category-key"
          name="key"
          required
          placeholder="manufacturer"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="dropdown-category-name" className="text-sm font-medium">Nombre</label>
        <input
          id="dropdown-category-name"
          name="name"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear categoría"}
      </button>
    </form>
  );
}
