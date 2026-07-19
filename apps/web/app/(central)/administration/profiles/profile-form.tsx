"use client";

import { createProfileAction } from "@/actions/profiles.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    await createProfileAction({
      name: formData.get("name") as string,
      interface: formData.get("interface") as "central" | "simplified",
      description: (formData.get("description") as string) || null,
      isDefault: formData.get("isDefault") === "on",
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function ProfileForm() {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="profile-name" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="profile-name"
          name="name"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="profile-interface" className="text-sm font-medium">
          Interfaz
        </label>
        <select
          id="profile-interface"
          name="interface"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          <option value="central">Central (admin/técnico)</option>
          <option value="simplified">Simplified (autoservicio)</option>
        </select>
      </div>
      <div>
        <label htmlFor="profile-description" className="text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="profile-description"
          name="description"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" /> Perfil por defecto
      </label>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear perfil"}
      </button>
    </form>
  );
}
