"use client";

import { updateMyLanguageAction } from "@/actions/account.actions";
import type { SUPPORTED_LANGUAGES } from "@itsm/core";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

interface FormState {
  error?: string;
  saved?: boolean;
}

export function LanguageForm({
  currentLanguage,
  options,
}: {
  currentLanguage: string;
  options: typeof SUPPORTED_LANGUAGES;
}) {
  const t = useTranslations("account");
  const router = useRouter();

  async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
    try {
      const language = formData.get("language") as string;
      await updateMyLanguageAction({ language });
      // unstable_update() sets a new session cookie on THIS action's own
      // response - Next's implicit post-action refresh re-renders Server
      // Components (including the root layout, which resolves the locale)
      // using the request's INCOMING cookies, not the one this response is
      // about to set. The browser only has the new cookie in its jar after
      // this response finishes, so a genuinely separate follow-up request
      // is required to see it - router.refresh() issues exactly that.
      router.refresh();
      return { saved: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  }

  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <label htmlFor="account-language" className="sr-only">
        {t("languageHeading")}
      </label>
      <select
        id="account-language"
        name="language"
        defaultValue={currentLanguage}
        className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
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
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? t("languageSaving") : t("languageSave")}
      </button>
      {state?.saved ? <span className="text-sm text-green-700 dark:text-green-400">{t("languageSaved")}</span> : null}
      {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
    </form>
  );
}
