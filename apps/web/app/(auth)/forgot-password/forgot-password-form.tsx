"use client";

import { requestPasswordResetAction } from "@/actions/auth.actions";
import Link from "next/link";
import { useActionState } from "react";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, undefined);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-6 rounded-md border border-black/10 p-8 dark:border-white/10">
      <div className="space-y-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-sm font-semibold text-white">G+</div>
        <div>
          <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
          <p className="mt-1 text-sm opacity-60">Te enviamos un link para elegir una contraseña nueva.</p>
        </div>
      </div>

      {state?.message ? (
        <p className="text-sm opacity-80">{state.message}</p>
      ) : (
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
      )}

      {!state?.message ? (
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Enviando..." : "Enviar link"}
        </button>
      ) : null}

      <Link href="/login" className="block text-center text-sm text-accent hover:underline">
        Volver a iniciar sesión
      </Link>
    </form>
  );
}
