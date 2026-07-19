"use server";

import { isSupportedLocale } from "@/i18n/request";
import { cookies } from "next/headers";

/**
 * Sets the `locale` cookie read by i18n/request.ts for unauthenticated pages
 * (there's no session yet to carry a language preference - see resolveLocale
 * there). Once the user logs in, session.language (JWT) takes over.
 */
export async function setLocaleCookieAction(locale: string): Promise<void> {
  if (!isSupportedLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
