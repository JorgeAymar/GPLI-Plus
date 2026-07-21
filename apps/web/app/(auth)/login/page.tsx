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
      <div className="absolute top-4 right-4 text-right">
        <LoginLanguageSwitcher currentLocale={locale} options={SUPPORTED_LANGUAGES} />
        <p className="mt-1 max-w-[16rem] text-xs opacity-50">
          Esto solo guarda tu preferencia. Todavía no cambia el idioma de la interfaz.
        </p>
      </div>
      <div className="flex flex-col items-center gap-4">
        <LoginForm callbackUrl={callbackUrl ?? "/"} />
        <p className="text-center text-xs opacity-40">© {new Date().getFullYear()} GLPI-Plus. Todos los derechos reservados.</p>
      </div>
    </div>
  );
}
