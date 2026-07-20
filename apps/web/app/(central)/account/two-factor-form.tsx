"use client";

import { updateMyTwoFactorAction } from "@/actions/account.actions";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

interface FormState {
  enabled: boolean;
  error?: string;
  saved?: boolean;
}

export function TwoFactorForm({ initialEnabled }: { initialEnabled: boolean }) {
  const t = useTranslations("account");

  async function action(prev: FormState, formData: FormData): Promise<FormState> {
    const nextEnabled = formData.get("intent") === "enable";
    try {
      const user = await updateMyTwoFactorAction(nextEnabled);
      return { enabled: user.twoFactorEnabled, saved: true };
    } catch (err) {
      return { ...prev, error: err instanceof Error ? err.message : "Error desconocido" };
    }
  }

  const [state, formAction, isPending] = useActionState(action, { enabled: initialEnabled });

  return (
    <form action={formAction} className="flex items-center gap-3">
      <span className="text-sm">{state.enabled ? t("twoFactorEnabled") : t("twoFactorDisabled")}</span>
      <input type="hidden" name="intent" value={state.enabled ? "disable" : "enable"} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
      >
        {isPending ? t("twoFactorSaving") : state.enabled ? t("twoFactorDisable") : t("twoFactorEnable")}
      </button>
      {state.saved ? <span className="text-sm text-green-700 dark:text-green-400">{t("twoFactorSaved")}</span> : null}
      {state.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
    </form>
  );
}
