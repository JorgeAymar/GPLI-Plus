# Motor de i18n — Fase 1 (infraestructura + piloto) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app actually render in the user's chosen language (`es`/`en`/`pt`/`fr`/`it`/`de`) for one representative module (nav sidebar + `/dashboard` + `/account`), proving the pattern end-to-end before the much larger sweep of the remaining ~35 pages (Fase 2, separate plan).

**Architecture:** `next-intl` without URL-based routing (no `[locale]` segment — the whole app requires login, no SEO need). Locale is resolved via the JWT (same mechanism already used for `activeEntityId`/`activeProfileId`), not a per-request DB query. Message files are namespaced JSON per language.

**Tech Stack:** Next.js 16 App Router, `next-intl@4.13.2` (already installed, API verified against the real package's `.d.ts` files — not guessed), Auth.js v5 JWT sessions.

**Spec:** `docs/superpowers/specs/2026-07-19-i18n-engine-design.md`

**User directive for this plan's execution: do not pause for approval between tasks or ask clarifying questions — execute straight through, only stopping for a genuine BLOCKED status.**

---

## Task 1: JWT/session carries `language`

**Files:**
- Modify: `apps/web/lib/auth.ts`

- [ ] **Step 1: Extend the Session/JWT type augmentations and callbacks**

In `apps/web/lib/auth.ts`, change:

```ts
declare module "next-auth" {
  interface Session {
    userId: string;
    activeEntityId: string | null;
    activeProfileId: string | null;
  }
}
```

to:

```ts
declare module "next-auth" {
  interface Session {
    userId: string;
    activeEntityId: string | null;
    activeProfileId: string | null;
    language: string;
  }
}
```

Change:

```ts
declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    activeEntityId?: string | null;
    activeProfileId?: string | null;
  }
}
```

to:

```ts
declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    activeEntityId?: string | null;
    activeProfileId?: string | null;
    language?: string;
  }
}
```

In the `jwt()` callback, change:

```ts
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.userId = user.id;
        // Resolve the default entity/profile immediately so the first
        // request post-login already has a usable active context.
        const context = await resolveAuthContext({
          userId: user.id,
          activeEntityId: null,
          activeProfileId: null,
        });
        token.activeEntityId = context?.activeEntity.id ?? null;
        token.activeProfileId = context?.activeProfile.id ?? null;
        // Fires exactly once per sign-in (this branch only runs when `user` is present,
        // i.e. right after `authorize()` succeeds) - covers both the local and LDAP paths
        // without duplicating the call in authorize()'s two return branches.
        await stampLastLogin(user.id);
      }

      if (trigger === "update" && session) {
        if ("activeEntityId" in session) token.activeEntityId = session.activeEntityId;
        if ("activeProfileId" in session) token.activeProfileId = session.activeProfileId;
      }

      return token;
    },
```

to:

```ts
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.userId = user.id;
        // Resolve the default entity/profile immediately so the first
        // request post-login already has a usable active context.
        const context = await resolveAuthContext({
          userId: user.id,
          activeEntityId: null,
          activeProfileId: null,
        });
        token.activeEntityId = context?.activeEntity.id ?? null;
        token.activeProfileId = context?.activeProfile.id ?? null;
        // context.user is the full users row resolveAuthContext already fetched -
        // reuse it instead of a second query just for language.
        token.language = context?.user.language ?? "es";
        // Fires exactly once per sign-in (this branch only runs when `user` is present,
        // i.e. right after `authorize()` succeeds) - covers both the local and LDAP paths
        // without duplicating the call in authorize()'s two return branches.
        await stampLastLogin(user.id);
      }

      if (trigger === "update" && session) {
        if ("activeEntityId" in session) token.activeEntityId = session.activeEntityId;
        if ("activeProfileId" in session) token.activeProfileId = session.activeProfileId;
        if ("language" in session) token.language = session.language;
      }

      return token;
    },
```

In the `session()` callback, change:

```ts
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.activeEntityId = (token.activeEntityId as string | null) ?? null;
      session.activeProfileId = (token.activeProfileId as string | null) ?? null;
      return session;
    },
```

to:

```ts
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.activeEntityId = (token.activeEntityId as string | null) ?? null;
      session.activeProfileId = (token.activeProfileId as string | null) ?? null;
      session.language = (token.language as string | undefined) ?? "es";
      return session;
    },
```

- [ ] **Step 2: Update `updateMyLanguageAction` to refresh the JWT immediately**

In `apps/web/actions/account.actions.ts`, find `updateMyLanguageAction`:

```ts
export async function updateMyLanguageAction(input: unknown): Promise<User> {
  const context = await requireAuthContext();
  const parsed = parseInput(updateLanguageSchema, input);
  const user = await updateUserLanguage(context.user.id, parsed.language);
  revalidatePath("/account");
  return user;
}
```

Add the `unstable_update` import from `@/lib/auth` at the top of the file (alongside the existing imports), and change the function to also refresh the session's JWT claim so the language change takes effect without re-login — same `update()` trigger mechanism the entity/profile switcher already uses:

```ts
import { unstable_update } from "@/lib/auth";
```

```ts
export async function updateMyLanguageAction(input: unknown): Promise<User> {
  const context = await requireAuthContext();
  const parsed = parseInput(updateLanguageSchema, input);
  const user = await updateUserLanguage(context.user.id, parsed.language);
  await unstable_update({ language: parsed.language });
  revalidatePath("/account");
  return user;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`

Expected: clean, zero errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/auth.ts apps/web/actions/account.actions.ts
git commit -m "Carry language on the JWT session, refreshed on change"
```

---

## Task 2: next-intl wiring (config, request locale resolution, root layout)

**Files:**
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/i18n/request.ts`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Wrap the Next config with the next-intl plugin**

In `apps/web/next.config.ts`, add the import and wrap the export:

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Emit a self-contained `.next/standalone` build (with a minimal server.js
  // and only the node_modules actually required at runtime). This is what
  // the production Dockerfile copies into the final image so it doesn't
  // need to ship the full workspace node_modules tree.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  output: "standalone",

  // @itsm/db and @itsm/core are workspace packages with no build step of
  // their own (their package.json "main"/"exports" point straight at
  // ./src/**.ts). Next.js only transpiles files inside the app by default,
  // so workspace deps like these must be listed here or the build (and the
  // standalone output tracing) will fail to process them.
  transpilePackages: ["@itsm/db", "@itsm/core"],
};

export default withNextIntl(nextConfig);
```

(Keep the existing comments on `output`/`transpilePackages` - only the import, the `withNextIntl` wrapper, and the final `export default` line change.)

- [ ] **Step 2: Create the request-locale resolver**

Create `apps/web/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

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
  const session = await auth();
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
```

- [ ] **Step 3: Wrap the root layout with the client provider**

Replace the full contents of `apps/web/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ITSM Platform",
  description: "Plataforma ITSM / gestión de activos IT",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create placeholder message files so the app can boot**

Create all 6 files with an empty object for now (Task 3/4 fill in real content) so nothing 404s while wiring is verified:

```bash
mkdir -p apps/web/messages
for l in es en pt fr it de; do echo '{}' > apps/web/messages/$l.json; done
```

- [ ] **Step 5: Verify the app still boots**

Restart the dev server if one is running (`pgrep -f "npm run dev" | xargs -r kill`, then `nohup npm run dev > /tmp/dev.log 2>&1 &`, wait for `curl http://localhost:3210/` to return a response), then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3210/login` - expect `200`, not `500`. Check the dev server log for any next-intl configuration errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/next.config.ts apps/web/i18n/request.ts apps/web/app/layout.tsx apps/web/messages
git commit -m "Wire next-intl: config plugin, JWT/cookie-based locale resolution, root provider"
```

---

## Task 3: Extract the Spanish source messages (`es.json`)

**Files:**
- Modify: `apps/web/messages/es.json`

- [ ] **Step 1: Write the exact source content**

This is a straight extraction of text that already exists verbatim in the 3 pilot files - no wording changes, no invented copy. Replace the contents of `apps/web/messages/es.json`:

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "account": "Mi cuenta",
    "sectionAsistencia": "Asistencia",
    "tickets": "Tickets",
    "problems": "Problemas",
    "changes": "Cambios",
    "recurringTickets": "Tickets recurrentes",
    "sectionActivos": "Activos",
    "allAssets": "Todos los activos",
    "computers": "Computadoras",
    "networkEquipment": "Equipos de red",
    "software": "Software",
    "dcim": "DCIM",
    "cables": "Cables",
    "sectionGestion": "Gestión",
    "suppliers": "Proveedores",
    "contacts": "Contactos",
    "contracts": "Contratos",
    "budgets": "Presupuestos",
    "certificates": "Certificados",
    "consumables": "Consumibles",
    "sectionHerramientas": "Herramientas",
    "knowledgeBase": "Base de conocimiento",
    "reservations": "Reservas",
    "projects": "Proyectos",
    "reports": "Reportes",
    "savedSearches": "Búsquedas guardadas",
    "rssFeeds": "Feeds RSS",
    "dashboards": "Dashboards",
    "reminders": "Recordatorios",
    "planning": "Planificación",
    "sectionAdministracion": "Administración",
    "entities": "Entidades",
    "users": "Usuarios",
    "groups": "Grupos",
    "profiles": "Perfiles",
    "auditLog": "Registro de auditoría",
    "sectionConfiguracion": "Configuración",
    "assetDefinitions": "Tipos de activo",
    "dropdowns": "Listas desplegables",
    "slaPolicies": "Políticas SLA",
    "notificationTemplates": "Plantillas de notificación",
    "rules": "Reglas",
    "inventoryAgents": "Agentes de inventario",
    "apiClients": "Clientes API",
    "webhooks": "Webhooks",
    "authSources": "Fuentes de autenticación (LDAP/OIDC)",
    "serviceCatalog": "Catálogo de servicios",
    "ticketFields": "Campos de ticket",
    "cronJobs": "Trabajos programados"
  },
  "dashboard": {
    "title": "Dashboard",
    "activeEntity": "Entidad activa",
    "activeProfile": "Perfil activo"
  },
  "account": {
    "title": "Mi cuenta",
    "dataHeading": "Datos",
    "name": "Nombre",
    "email": "Email",
    "activeEntity": "Entidad activa",
    "activeProfile": "Perfil activo",
    "languageHeading": "Idioma",
    "languageDisclaimer": "Esto solo guarda tu preferencia. Todavía no cambia el idioma de la interfaz.",
    "languageSave": "Guardar",
    "languageSaving": "Guardando...",
    "languageSaved": "Guardado.",
    "tokensHeading": "Tokens MCP",
    "tokensDescription": "Tokens personales para conectar clientes MCP (Claude Desktop, Claude Code, etc.) contra {endpoint}. Actúan con tus mismos permisos — solo lectura por ahora.",
    "tokenColName": "Nombre",
    "tokenColPrefix": "Prefijo",
    "tokenColStatus": "Estado",
    "tokenColLastUsed": "Último uso",
    "tokenStatusActive": "Activo",
    "tokenStatusRevoked": "Revocado",
    "tokenLastUsedNever": "Nunca",
    "tokenEmpty": "Sin tokens todavía.",
    "tokenRevoke": "Revocar",
    "tokenRevoking": "Revocando...",
    "tokenFormName": "Nombre",
    "tokenFormCreate": "Crear token",
    "tokenFormCreating": "Creando...",
    "tokenCreatedNotice": "Token \"{name}\" creado. Copiá esta key ahora — no se puede volver a mostrar."
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/messages/es.json
git commit -m "Extract Spanish source strings for the nav/dashboard/account pilot"
```

---

## Task 4: Translate into the other 5 languages

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/pt.json`
- Modify: `apps/web/messages/fr.json`
- Modify: `apps/web/messages/it.json`
- Modify: `apps/web/messages/de.json`

- [ ] **Step 1: Translate `es.json`'s exact structure into each of the 5 files**

For each of `en.json`, `pt.json`, `fr.json`, `it.json`, `de.json`: copy `es.json`'s exact JSON key structure (same nesting, same keys, same `{placeholder}` tokens like `{endpoint}`/`{name}` left as literal placeholders, not translated) and translate every string value into the target language.

Translation guidance (this is a first AI-generated draft, not natively reviewed - flag this explicitly, see Step 2):
- Register: professional, neutral B2B software tone - matches how the existing Spanish copy reads (e.g. "Iniciar sesión", not "Entrar"; formal "tu"/"your" not overly casual).
- IT/ITSM domain terms: use the standard term an IT professional in that language/market would expect (e.g. "SLA", "webhook", "API" stay as-is in every language - these are industry-standard terms, not translated). For Portuguese, use Brazilian Portuguese (larger ITSM market than European Portuguese for this product).
- Section labels (`nav.section*`) are short category headers (1-3 words), not sentences.
- Keep `{placeholder}` tokens (e.g. `{endpoint}`, `{name}`) exactly as-is, in the same position they'd naturally occur in that language's sentence structure.

- [ ] **Step 2: Add an explicit "first draft" marker**

At the very top of each of the 5 translated files (en/pt/fr/it/de - not es.json, which is the reviewed source), add a `"_meta"` key documenting this:

```json
{
  "_meta": {
    "reviewedByNativeSpeaker": false,
    "note": "Primer borrador generado por IA a partir de es.json. No revisado por un hablante nativo todavía - ver docs/superpowers/specs/2026-07-19-i18n-engine-design.md, sección 'Fuera de alcance'."
  },
  "nav": { ... },
  "dashboard": { ... },
  "account": { ... }
}
```

- [ ] **Step 3: Verify all 6 files are valid JSON with identical key structure**

Run this check (fails loudly if any file has extra/missing keys vs es.json, ignoring the `_meta` key which only exists in the 5 non-source files):

```bash
cd apps/web/messages
node -e '
const fs = require("fs");
const es = JSON.parse(fs.readFileSync("es.json", "utf8"));
const keysOf = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keysOf(v, prefix + k + ".") : [prefix + k]
  );
const esKeys = new Set(keysOf(es));
for (const lang of ["en", "pt", "fr", "it", "de"]) {
  const data = JSON.parse(fs.readFileSync(`${lang}.json`, "utf8"));
  const { _meta, ...rest } = data;
  const langKeys = new Set(keysOf(rest));
  const missing = [...esKeys].filter((k) => !langKeys.has(k));
  const extra = [...langKeys].filter((k) => !esKeys.has(k));
  if (missing.length || extra.length) {
    console.error(`${lang}.json MISMATCH - missing: ${missing.join(", ")} | extra: ${extra.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`${lang}.json OK (${langKeys.size} keys match)`);
  }
}
'
```

Expected: `OK` for all 5 languages, zero mismatches. Fix any reported missing/extra keys before proceeding - a missing key means next-intl throws at render time for that locale.

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/pt.json apps/web/messages/fr.json apps/web/messages/it.json apps/web/messages/de.json
git commit -m "Translate pilot messages into en/pt/fr/it/de (first AI-generated draft)"
```

---

## Task 5: Migrate `nav-sidebar.tsx`

**Files:**
- Modify: `apps/web/components/layout/nav-sidebar.tsx`

- [ ] **Step 1: Replace hardcoded labels with translation keys**

Replace the full contents of `apps/web/components/layout/nav-sidebar.tsx`:

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface NavItem {
  href?: string;
  labelKey: string;
  section?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard" },
  { href: "/account", labelKey: "account" },
  { labelKey: "sectionAsistencia", section: true },
  { href: "/assistance/tickets", labelKey: "tickets" },
  { href: "/assistance/problems", labelKey: "problems" },
  { href: "/assistance/changes", labelKey: "changes" },
  { href: "/assistance/recurring-tickets", labelKey: "recurringTickets" },
  { labelKey: "sectionActivos", section: true },
  { href: "/assets", labelKey: "allAssets" },
  { href: "/assets/computers", labelKey: "computers" },
  { href: "/assets/network-equipment", labelKey: "networkEquipment" },
  { href: "/assets/software", labelKey: "software" },
  { href: "/assets/dcim", labelKey: "dcim" },
  { href: "/assets/dcim/cables", labelKey: "cables" },
  { labelKey: "sectionGestion", section: true },
  { href: "/management/suppliers", labelKey: "suppliers" },
  { href: "/management/contacts", labelKey: "contacts" },
  { href: "/management/contracts", labelKey: "contracts" },
  { href: "/management/budgets", labelKey: "budgets" },
  { href: "/management/certificates", labelKey: "certificates" },
  { href: "/management/consumables", labelKey: "consumables" },
  { labelKey: "sectionHerramientas", section: true },
  { href: "/tools/knowledge-base", labelKey: "knowledgeBase" },
  { href: "/tools/reservations", labelKey: "reservations" },
  { href: "/tools/projects", labelKey: "projects" },
  { href: "/tools/reports", labelKey: "reports" },
  { href: "/tools/saved-searches", labelKey: "savedSearches" },
  { href: "/tools/rss-feeds", labelKey: "rssFeeds" },
  { href: "/tools/dashboards", labelKey: "dashboards" },
  { href: "/tools/reminders", labelKey: "reminders" },
  { href: "/tools/planning", labelKey: "planning" },
  { labelKey: "sectionAdministracion", section: true },
  { href: "/administration/entities", labelKey: "entities" },
  { href: "/administration/users", labelKey: "users" },
  { href: "/administration/groups", labelKey: "groups" },
  { href: "/administration/profiles", labelKey: "profiles" },
  { href: "/administration/audit-log", labelKey: "auditLog" },
  { labelKey: "sectionConfiguracion", section: true },
  { href: "/setup/asset-definitions", labelKey: "assetDefinitions" },
  { href: "/setup/dropdowns", labelKey: "dropdowns" },
  { href: "/setup/sla-policies", labelKey: "slaPolicies" },
  { href: "/setup/notification-templates", labelKey: "notificationTemplates" },
  { href: "/setup/rules", labelKey: "rules" },
  { href: "/setup/inventory-agents", labelKey: "inventoryAgents" },
  { href: "/setup/api-clients", labelKey: "apiClients" },
  { href: "/setup/webhooks", labelKey: "webhooks" },
  { href: "/setup/auth-sources", labelKey: "authSources" },
  { href: "/setup/service-catalog", labelKey: "serviceCatalog" },
  { href: "/setup/ticket-fields", labelKey: "ticketFields" },
  { href: "/setup/cron-jobs", labelKey: "cronJobs" },
];

export async function NavSidebar() {
  const t = await getTranslations("nav");

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 p-4 dark:border-white/10">
      {NAV.map((item) =>
        item.section ? (
          <div key={item.labelKey} className="mt-4 px-3 pb-1 text-xs font-medium uppercase tracking-wide opacity-50 first:mt-0">
            {t(item.labelKey)}
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href!}
            className="rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            {t(item.labelKey)}
          </Link>
        ),
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Confirm `NavSidebar`'s caller doesn't break on it becoming async**

`NavSidebar` was a synchronous function component; it's now `async`. Find its usage: `grep -rn "NavSidebar" apps/web/app`. It's rendered inside `apps/web/app/(central)/layout.tsx`, which is already an `async function CentralLayout`. An async Server Component can render another async Server Component directly as JSX (`<NavSidebar />`) without any special handling - Next.js resolves it. No changes needed there, but open the file and confirm `<NavSidebar />` is called as plain JSX (not e.g. passed as a prop expecting a sync value) before moving on.

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/nav-sidebar.tsx
git commit -m "Migrate nav-sidebar.tsx to next-intl translations"
```

---

## Task 6: Migrate `/dashboard`

**Files:**
- Modify: `apps/web/app/(central)/dashboard/page.tsx`

- [ ] **Step 1: Replace hardcoded strings**

Replace the full contents of `apps/web/app/(central)/dashboard/page.tsx`:

```tsx
import { requireAuthContext } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const context = await requireAuthContext();
  const t = await getTranslations("dashboard");

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm opacity-70">
        {t("activeEntity")}: <strong>{context.activeEntity.name}</strong> · {t("activeProfile")}:{" "}
        <strong>{context.activeProfile.name}</strong> ({context.activeProfile.interface})
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(central)/dashboard/page.tsx"
git commit -m "Migrate /dashboard to next-intl translations"
```

---

## Task 7: Migrate `/account` (page + 3 client components)

**Files:**
- Modify: `apps/web/app/(central)/account/page.tsx`
- Modify: `apps/web/app/(central)/account/token-form.tsx`
- Modify: `apps/web/app/(central)/account/revoke-token-button.tsx`
- Modify: `apps/web/app/(central)/account/language-form.tsx`

This is the task that exercises both the Server Component (`getTranslations`) and Client Component (`useTranslations`) paths - the exact mix the Fase 2 sweep will need everywhere else.

- [ ] **Step 1: Migrate the page (Server Component)**

Replace the full contents of `apps/web/app/(central)/account/page.tsx`:

```tsx
import { requireAuthContext } from "@/lib/session";
import { listMyApiClients, SUPPORTED_LANGUAGES } from "@itsm/core";
import { getTranslations } from "next-intl/server";
import { LanguageForm } from "./language-form";
import { RevokeTokenButton } from "./revoke-token-button";
import { TokenForm } from "./token-form";

export default async function AccountPage() {
  const context = await requireAuthContext();
  const tokens = await listMyApiClients(context.user.id);
  const t = await getTranslations("account");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium opacity-70">{t("dataHeading")}</h2>
        <dl className="grid max-w-md grid-cols-2 gap-y-1 text-sm">
          <dt className="opacity-60">{t("name")}</dt>
          <dd>{context.user.displayName}</dd>
          <dt className="opacity-60">{t("email")}</dt>
          <dd>{context.user.email}</dd>
          <dt className="opacity-60">{t("activeEntity")}</dt>
          <dd>{context.activeEntity.name}</dd>
          <dt className="opacity-60">{t("activeProfile")}</dt>
          <dd>{context.activeProfile.name}</dd>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium opacity-70">{t("languageHeading")}</h2>
        <LanguageForm currentLanguage={context.user.language} options={SUPPORTED_LANGUAGES} />
        <p className="max-w-md text-xs opacity-50">{t("languageDisclaimer")}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium opacity-70">{t("tokensHeading")}</h2>
        <p className="max-w-2xl text-sm opacity-70">
          {t.rich("tokensDescription", {
            endpoint: () => <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">/api/mcp</code>,
          })}
        </p>

        <div className="grid grid-cols-2 gap-8">
          <div className="min-w-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left opacity-60">
                    <th className="pb-2">{t("tokenColName")}</th>
                    <th className="pb-2">{t("tokenColPrefix")}</th>
                    <th className="pb-2">{t("tokenColStatus")}</th>
                    <th className="pb-2">{t("tokenColLastUsed")}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((tk) => (
                    <tr key={tk.id} className="border-t border-black/5 dark:border-white/5">
                      <td className="py-2">{tk.name}</td>
                      <td className="py-2 font-mono opacity-70">{tk.apiKeyPrefix}…</td>
                      <td className="py-2">
                        {tk.isActive ? (
                          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-700 dark:text-green-400">
                            {t("tokenStatusActive")}
                          </span>
                        ) : (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-700 dark:text-red-400">
                            {t("tokenStatusRevoked")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 whitespace-nowrap opacity-70">
                        {tk.lastUsedAt ? tk.lastUsedAt.toLocaleString() : t("tokenLastUsedNever")}
                      </td>
                      <td className="py-2">{tk.isActive ? <RevokeTokenButton id={tk.id} /> : null}</td>
                    </tr>
                  ))}
                  {tokens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-2 opacity-50">
                        {t("tokenEmpty")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <TokenForm />
          </div>
        </div>
      </section>
    </div>
  );
}
```

Note: `t.rich(...)` is next-intl's API for a translation string containing an embedded React element (here, the `<code>/api/mcp</code>` inline in the middle of a sentence) - it needs the `{endpoint}` placeholder in `es.json`'s `tokensDescription` to use next-intl's rich-text tag syntax instead of a plain placeholder. Before running this, go back and update `apps/web/messages/es.json`'s (and all 5 translated files') `account.tokensDescription` value to use next-intl's tag syntax: `"Tokens personales para conectar clientes MCP (Claude Desktop, Claude Code, etc.) contra <endpoint>/api/mcp</endpoint>. Actúan con tus mismos permisos — solo lectura por ahora."` (i.e. replace the `{endpoint}` placeholder from Task 3/4 with an `<endpoint>...</endpoint>` tag pair, keeping `/api/mcp` as the literal tag content in every language - it's a URL path, not translatable text). If you already committed Task 3/4 before reaching this step, amend `es.json` and all 5 translated files with this correction as part of this task's commit, don't leave two inconsistent placeholder styles in the codebase.

- [ ] **Step 2: Migrate `token-form.tsx` (Client Component)**

Replace the full contents of `apps/web/app/(central)/account/token-form.tsx`:

```tsx
"use client";

import { createMyApiClientAction } from "@/actions/account.actions";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

interface FormState {
  error?: string;
  rawKey?: string;
  clientName?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    const name = formData.get("name") as string;
    const result = await createMyApiClientAction({ name });
    return { rawKey: result.rawKey, clientName: result.client.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function TokenForm() {
  const t = useTranslations("account");
  const [state, formAction, isPending] = useActionState(action, undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <div className="space-y-4">
      {state?.rawKey ? (
        <div className="space-y-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            {t("tokenCreatedNotice", { name: state.clientName ?? "" })}
          </p>
          <pre className="overflow-x-auto rounded bg-black/80 p-2 text-xs text-green-400">{state.rawKey}</pre>
        </div>
      ) : null}

      <form action={formAction} className="space-y-3">
        <div>
          <label htmlFor="token-name" className="text-sm font-medium">{t("tokenFormName")}</label>
          <input id="token-name" name="name" required placeholder="claude-desktop" className={inputClass} />
        </div>
        {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {isPending ? t("tokenFormCreating") : t("tokenFormCreate")}
        </button>
      </form>
    </div>
  );
}
```

Note: `tokenCreatedNotice` in `es.json` currently reads `"Token \"{name}\" creado. ..."` - that's already a plain `{name}` placeholder (not rich text, no embedded element), so `t("tokenCreatedNotice", { name: ... })` (not `t.rich`) is correct here - don't apply the same `<tag>` treatment as `tokensDescription` in Step 1, only that one string has an embedded React element.

- [ ] **Step 3: Migrate `revoke-token-button.tsx` (Client Component)**

Replace the full contents of `apps/web/app/(central)/account/revoke-token-button.tsx`:

```tsx
"use client";

import { revokeMyApiClientAction } from "@/actions/account.actions";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

interface RevokeState {
  error?: string;
}

async function action(_prev: RevokeState | undefined, formData: FormData): Promise<RevokeState> {
  try {
    await revokeMyApiClientAction(formData.get("id") as string);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function RevokeTokenButton({ id }: { id: string }) {
  const t = useTranslations("account");
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {isPending ? t("tokenRevoking") : t("tokenRevoke")}
      </button>
      {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
```

- [ ] **Step 4: Migrate `language-form.tsx` (Client Component)**

Replace the full contents of `apps/web/app/(central)/account/language-form.tsx`:

```tsx
"use client";

import { updateMyLanguageAction } from "@/actions/account.actions";
import type { SUPPORTED_LANGUAGES } from "@itsm/core";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

interface FormState {
  error?: string;
  saved?: boolean;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    const language = formData.get("language") as string;
    await updateMyLanguageAction({ language });
    return { saved: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function LanguageForm({
  currentLanguage,
  options,
}: {
  currentLanguage: string;
  options: typeof SUPPORTED_LANGUAGES;
}) {
  const t = useTranslations("account");
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
```

(Note: the `<option>` labels for language NAMES themselves - "Español", "English", etc. - come from `SUPPORTED_LANGUAGES` in `packages/core/src/validation/user.zod.ts`, not from the message catalog. They're proper nouns / language autonyms, not UI copy that changes per-locale - a language's own name is conventionally shown in that language regardless of the current UI locale, matching how every OS/browser language picker works. Don't move these into messages/*.json.)

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(central)/account"
git commit -m "Migrate /account (page + 3 client components) to next-intl translations"
```

---

## Task 8: Language selector on `/login` (cookie-based, no session yet)

**Files:**
- Create: `apps/web/actions/locale.actions.ts`
- Create: `apps/web/app/(auth)/login/login-language-switcher.tsx`
- Modify: `apps/web/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create the cookie-setting server action**

Create `apps/web/actions/locale.actions.ts`:

```ts
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
```

- [ ] **Step 2: Create the switcher component**

Create `apps/web/app/(auth)/login/login-language-switcher.tsx`:

```tsx
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
```

- [ ] **Step 3: Add it to the login page**

Replace the full contents of `apps/web/app/(auth)/login/page.tsx`:

```tsx
import { resolveLocale } from "@/i18n/request";
import { SUPPORTED_LANGUAGES } from "@itsm/core";
import { LoginForm } from "./login-form";
import { LoginLanguageSwitcher } from "./login-language-switcher";

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
```

(`LoginForm` itself is out of scope for this pilot - it stays hardcoded Spanish for now, same as every other non-piloted page. This task only proves the pre-login cookie mechanism works, via the one piece of UI that's actually testable pre-login: the switcher itself and its effect on a subsequent authenticated page's language.)

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add apps/web/actions/locale.actions.ts "apps/web/app/(auth)/login"
git commit -m "Add pre-login language switcher (cookie-based, no session yet)"
```

---

## Task 9: Tests

**Files:**
- Create: `apps/web/i18n/request.test.ts`
- Modify: `e2e/specs/account.spec.ts`

- [ ] **Step 1: Write the failing unit test for locale resolution**

Create `apps/web/i18n/request.test.ts`:

```ts
import { describe, expect, it } from "vitest";
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
```

- [ ] **Step 2: Run it to verify it passes**

Run: `cd apps/web && npx vitest run i18n/request.test.ts`

Expected: PASS, 4/4 (this hits pure exported functions, no next-intl runtime/DB/auth involved, so it should pass immediately if `i18n/request.ts` exports match - if it fails, re-check Task 2's exact export names).

- [ ] **Step 3: Extend the e2e language-persistence test to verify actual rendered text changes**

In `e2e/specs/account.spec.ts`, find the test `"cambiar el idioma persiste tras recargar"`. After the existing assertion `await expect(page.locator('select[name="language"]')).toHaveValue("fr")`, add (still inside the `try` block, before the `finally`):

```ts
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mon compte");
      await expect(page.getByRole("link", { name: "Tableau de bord" })).toBeVisible();
```

(French was chosen since it's already the language this test switches to - no need to add a 4th language just for this assertion. `"Mon compte"` and `"Tableau de bord"` must match exactly what Task 4 put in `fr.json`'s `account.title` and `nav.dashboard` - if Task 4's actual translated values differ from these, use the real values from `fr.json` instead of literally copying this snippet.)

- [ ] **Step 4: Run the updated e2e spec**

Run: `npx playwright test e2e/specs/account.spec.ts` (dev server must be running on :3210 - check first, don't start/stop it yourself, report BLOCKED if it's down and let the coordinator investigate, this session has had it crash from unrelated resource exhaustion multiple times already)

Expected: 4/4 pass (3 original + auth setup), with the language test now also asserting real rendered French text, not just the `<select>` value.

- [ ] **Step 5: Run the full test suites to confirm no regressions**

```bash
cd /Users/jorgesaymar/Desktop/proyectos-dev/GLPI-Plus
npx turbo run test --force
npx turbo run typecheck --force
npm run e2e
```

Expected: all green. This is a bigger blast radius than most prior tasks (touches the root layout and a shared nav component every single page renders through), so a full-suite pass here matters more than usual.

- [ ] **Step 6: Commit**

```bash
git add apps/web/i18n/request.test.ts e2e/specs/account.spec.ts
git commit -m "Add locale-resolution unit tests and extend e2e to assert real translated text"
```

---

## Self-Review Notes (already applied above)

- **Spec coverage:** Section A (JWT) → Task 1; B (next-intl config) → Task 2; C (message structure) → Tasks 3-4; D (pilot migration) → Tasks 5-7; login cookie → Task 8; E (testing) → Task 9. All covered.
- **Type consistency:** `resolveLocale`, `isSupportedLocale`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE` (all from `apps/web/i18n/request.ts`) are referenced identically across Tasks 2, 8, and 9 - verified by re-reading those tasks against each other after drafting.
- **Known scope boundary, not a placeholder:** `LoginForm`'s own labels (Email, Contraseña, Iniciar sesión, etc.) are explicitly NOT migrated in this plan - only the pre-login *switcher* is proven to work. Fase 2 covers the rest of `/login` along with everything else.
