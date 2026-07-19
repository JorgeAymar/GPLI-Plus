import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";

export const SUPPORTED_LOCALES = ["es", "en", "pt", "fr", "it", "de"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "es";

export function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * No [locale] URL segment (the whole app requires login, no SEO need - see
 * docs/superpowers/specs/2026-07-19-i18n-engine-design.md section B), so
 * `requestLocale` from next-intl (which normally reads the segment) is
 * always undefined here. Resolve manually instead:
 * 1. Logged-in user -> session.language (JWT, no DB query - see lib/auth.ts).
 * 2. No session (e.g. /login) -> the `locale` cookie set by the login page's
 *    language switcher.
 * 3. Neither -> "es".
 */
export async function resolveLocale(): Promise<SupportedLocale> {
  const session = await getSession();
  if (session?.language && isSupportedLocale(session.language)) {
    return session.language;
  }

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  if (isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
