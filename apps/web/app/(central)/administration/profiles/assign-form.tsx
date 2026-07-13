"use client";

import { assignUserProfileAction } from "@/actions/profiles.actions";
import type { Entity, Profile, User } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    await assignUserProfileAction({
      userId: formData.get("userId") as string,
      profileId: formData.get("profileId") as string,
      entityId: formData.get("entityId") as string,
      isRecursive: formData.get("isRecursive") === "on",
      isDefault: formData.get("isDefault") === "on",
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function AssignForm({ users, profiles, entities }: { users: User[]; profiles: Profile[]; entities: Entity[] }) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid max-w-2xl grid-cols-2 gap-3">
      <div>
        <label className="text-sm font-medium">Usuario</label>
        <select
          name="userId"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Perfil</label>
        <select
          name="profileId"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Entidad</label>
        <select
          name="entityId"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isRecursive" defaultChecked /> Recursivo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isDefault" /> Por defecto
        </label>
      </div>
      <div className="col-span-2">
        {state?.error ? <p className="mb-2 text-sm text-red-600">{state.error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {isPending ? "Asignando..." : "Asignar"}
        </button>
      </div>
    </form>
  );
}
