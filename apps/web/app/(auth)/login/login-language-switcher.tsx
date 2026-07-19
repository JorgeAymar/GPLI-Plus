"use client";

import { setLocaleCookieAction } from "@/actions/locale.actions";
import type { SUPPORTED_LANGUAGES } from "@itsm/core";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LoginLanguageSwitcher({
  currentLocale,
  options,
}: {
  currentLocale: string;
  options: typeof SUPPORTED_LANGUAGES;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      aria-label="Idioma / Language"
      defaultValue={currentLocale}
      disabled={isPending}
      onChange={(e) => {
        const value = e.target.value;
        startTransition(async () => {
          await setLocaleCookieAction(value);
          router.refresh();
        });
      }}
      className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/15"
    >
      {options.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}
