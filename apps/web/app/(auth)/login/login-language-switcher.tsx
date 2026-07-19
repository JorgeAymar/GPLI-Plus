"use client";

import { setLocaleCookieAction } from "@/actions/locale.actions";
import type { SUPPORTED_LANGUAGES } from "@itsm/core";
import { useActionState } from "react";

async function action(_prev: undefined, formData: FormData): Promise<undefined> {
  await setLocaleCookieAction(formData.get("locale") as string);
  return undefined;
}

export function LoginLanguageSwitcher({
  currentLocale,
  options,
}: {
  currentLocale: string;
  options: typeof SUPPORTED_LANGUAGES;
}) {
  const [, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-1">
      <label htmlFor="login-locale" className="sr-only">
        Idioma / Language
      </label>
      <select
        id="login-locale"
        name="locale"
        aria-label="Idioma / Language"
        defaultValue={currentLocale}
        disabled={isPending}
        className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/15"
      >
        {options.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        aria-label="Cambiar idioma / Change language"
        className="rounded-md border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/15"
      >
        →
      </button>
    </form>
  );
}
