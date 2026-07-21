"use client";

import { loginAction, type LoginState } from "@/actions/auth.actions";
import Link from "next/link";
import { useActionState, useState } from "react";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);
  // "Volver" just needs to hide the code screen for THIS state object without
  // a new server round-trip - tracking which state was dismissed (rather than
  // a separate step flag kept in sync via an effect) means going back is a
  // plain derived value, not a client/server state to synchronize.
  const [dismissed, setDismissed] = useState<LoginState | undefined>(undefined);
  const inputClass = "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";
  const showCode = state?.step === "code" && state !== dismissed;

  if (showCode && state?.email && state?.password) {
    return (
      <form
        action={formAction}
        className="w-full max-w-sm space-y-6 rounded-md border border-black/10 p-8 dark:border-white/10"
      >
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-sm font-semibold text-white">G+</div>
          <div>
            <h1 className="text-2xl font-semibold">Verificá tu identidad</h1>
            <p className="mt-1 text-sm opacity-60">Te enviamos un código de 4 dígitos a {state.email}.</p>
          </div>
        </div>

        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="password" value={state.password} />

        <div className="space-y-1">
          <label htmlFor="code" className="text-sm font-medium">
            Código
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            required
            autoComplete="one-time-code"
            defaultValue={state.debugCode}
            className={`${inputClass} text-center text-lg tracking-[0.5em]`}
          />
        </div>

        {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Verificando..." : "Verificar"}
        </button>

        <button type="button" onClick={() => setDismissed(state)} className="w-full text-center text-sm opacity-60 hover:opacity-100">
          Volver
        </button>
      </form>
    );
  }

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-6 rounded-md border border-black/10 p-8 dark:border-white/10"
    >
      <div className="flex flex-col items-center space-y-3 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-sm font-semibold text-white">G+</div>
        <div>
          <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
          <p className="mt-1 text-sm opacity-60">Plataforma ITSM</p>
        </div>
      </div>

      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <Link href="/forgot-password" className="text-xs text-accent hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className={`${inputClass} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center gap-1 px-3 text-xs opacity-60 hover:opacity-100"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                {showPassword ? (
                  <path d="M3 3l14 14M9.5 9.7a2 2 0 0 0 2.8 2.8M7 5.3A8.6 8.6 0 0 1 10 5c4 0 7 3 8 5-.4.8-1.3 2.1-2.7 3.2M5.2 6.9C3.8 8 2.9 9.3 2.5 10c1 2 4 5 7.5 5 .9 0 1.7-.2 2.5-.5" />
                ) : (
                  <>
                    <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" />
                    <circle cx="10" cy="10" r="2.25" />
                  </>
                )}
              </svg>
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
      </div>

      {state?.error && !showCode ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
