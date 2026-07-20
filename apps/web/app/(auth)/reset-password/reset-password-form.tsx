"use client";

import { resetPasswordAction } from "@/actions/auth.actions";
import Link from "next/link";
import { useActionState, useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const inputClass = "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  if (state?.success) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-md border border-black/10 p-8 text-center dark:border-white/10">
        <h1 className="text-2xl font-semibold">Contraseña actualizada</h1>
        <p className="text-sm opacity-70">Ya podés iniciar sesión con tu nueva contraseña.</p>
        <Link href="/login" className="inline-block rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full max-w-sm space-y-6 rounded-md border border-black/10 p-8 dark:border-white/10">
      <div className="space-y-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-sm font-semibold text-white">G+</div>
        <div>
          <h1 className="text-2xl font-semibold">Elegí una contraseña nueva</h1>
          <p className="mt-1 text-sm opacity-60">Mínimo 8 caracteres.</p>
        </div>
      </div>

      <input type="hidden" name="token" value={token} />

      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              className={`${inputClass} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 px-3 text-xs opacity-60 hover:opacity-100"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
      </div>

      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}
