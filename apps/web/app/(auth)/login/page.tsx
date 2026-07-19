import { resolveLocale } from "@/i18n/request";
import { SUPPORTED_LANGUAGES } from "@itsm/core";
import { LoginForm } from "./login-form";
import { LoginLanguageSwitcher } from "./login-language-switcher";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const locale = await resolveLocale();

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <div className="absolute top-4 right-4">
        <LoginLanguageSwitcher currentLocale={locale} options={SUPPORTED_LANGUAGES} />
      </div>
      <LoginForm callbackUrl={callbackUrl ?? "/"} />
    </div>
  );
}
