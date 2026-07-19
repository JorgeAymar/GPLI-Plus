import { describe, expect, it, vi } from "vitest";

// `./request.ts` imports `@/lib/auth` (for resolveLocale's session lookup),
// which in turn imports `@itsm/db` and throws at module-load time if
// DATABASE_URL isn't set (it also opens a live pg Pool as a side effect).
// This test only exercises the pure exports below (isSupportedLocale,
// DEFAULT_LOCALE, SUPPORTED_LOCALES), none of which touch auth/DB, so stub
// the module out rather than requiring a real DB connection just to import it.
vi.mock("@/lib/auth", () => ({ getSession: vi.fn().mockResolvedValue(null) }));

import { isSupportedLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./request";

describe("isSupportedLocale", () => {
  it("accepts every locale in SUPPORTED_LOCALES", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(locale)).toBe(true);
    }
  });

  it("rejects an unsupported code", () => {
    expect(isSupportedLocale("xx")).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isSupportedLocale(undefined)).toBe(false);
  });
});

describe("DEFAULT_LOCALE", () => {
  it("is Spanish", () => {
    expect(DEFAULT_LOCALE).toBe("es");
  });
});
