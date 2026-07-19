import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, digits, dots, dashes and underscores"),
  password: z.string().min(8),
  displayName: z.string().min(1).max(255),
  defaultEntityId: z.string().uuid().nullable().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Single source of truth for language codes - both the Zod enum below and
 * the <select> in apps/web/app/(central)/account/language-form.tsx read from
 * this, so they can't drift out of sync.
 */
export const SUPPORTED_LANGUAGES = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
  { code: "pt", name: "Português" },
  { code: "fr", name: "Français" },
  { code: "it", name: "Italiano" },
  { code: "de", name: "Deutsch" },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code) as [SupportedLanguageCode, ...SupportedLanguageCode[]];

export const updateLanguageSchema = z.object({
  language: z.enum(LANGUAGE_CODES),
});
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;
