"use client";

import { createUserAction } from "@/actions/users.actions";
import { useFormSuccessToast } from "@/components/toast";
import type { Entity } from "@itsm/db";
import { useActionState, useRef, useState } from "react";

interface FormState {
  error?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  // Password-match is checked client-side in handleSubmit, BEFORE this action
  // ever runs (see UserForm) - React resets a form's uncontrolled fields
  // whenever an action tied to it completes, success or not, so letting a
  // simple mismatch reach this action would wipe out everything the admin
  // just typed. Kept here too as a defense-in-depth backstop.
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const result = await createUserAction({
    email: formData.get("email") as string,
    username: formData.get("username") as string,
    password,
    displayName: formData.get("displayName") as string,
    defaultEntityId: (formData.get("defaultEntityId") as string) || null,
  });
  return result.error ? { error: result.error } : {};
}

export function UserForm({ entities }: { entities: Entity[] }) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useFormSuccessToast(state, formRef, "Usuario creado.");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;
    if (password !== confirmPassword) {
      e.preventDefault();
      setMismatchError("Las contraseñas no coinciden.");
      return;
    }
    setMismatchError(null);
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="user-displayName" className="text-sm font-medium">
          Nombre para mostrar
        </label>
        <input
          id="user-displayName"
          name="displayName"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="user-username" className="text-sm font-medium">
          Usuario
        </label>
        <input
          id="user-username"
          name="username"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="user-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="user-email"
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="user-password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="user-password"
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
        <p className="mt-1 text-xs opacity-50">Mínimo 8 caracteres.</p>
      </div>
      <div>
        <label htmlFor="user-confirmPassword" className="text-sm font-medium">
          Confirmar contraseña
        </label>
        <input
          id="user-confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="user-defaultEntityId" className="text-sm font-medium">
          Entidad por defecto
        </label>
        <select
          id="user-defaultEntityId"
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
      {mismatchError ?? state?.error ? <p className="text-sm text-red-600">{mismatchError ?? state?.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear usuario"}
      </button>
    </form>
  );
}
