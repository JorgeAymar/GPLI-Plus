"use client";

import { loginAction } from "@/actions/auth.actions";
import { useActionState } from "react";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, undefined);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-4 rounded-lg border border-black/10 p-8 shadow-sm dark:border-white/10"
    >
      <div>
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <p className="text-sm opacity-60">Plataforma ITSM</p>
      </div>

      <input type="hidden" name="callbackUrl" value={callbackUrl} />

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

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>

      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
