"use client";

import { createUserAction } from "@/actions/users.actions";
import type { Entity } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    await createUserAction({
      email: formData.get("email") as string,
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      displayName: formData.get("displayName") as string,
      defaultEntityId: (formData.get("defaultEntityId") as string) || null,
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function UserForm({ entities }: { entities: Entity[] }) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Nombre para mostrar</label>
        <input
          name="displayName"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Usuario</label>
        <input
          name="username"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Email</label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Entidad por defecto</label>
        <select
          name="defaultEntityId"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          <option value="">(ninguna)</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear usuario"}
      </button>
    </form>
  );
}
