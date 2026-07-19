# Motor de i18n real (Fase 1: infraestructura + módulo piloto)

## Contexto

`/account` ya deja al usuario elegir un idioma preferido (`es`/`en`/`pt`/`fr`/`it`/`de`) pero solo guarda la preferencia — la UI sigue 100% en español hardcodeado en ~40+ páginas. Este spec cubre el motor real que hace que la app efectivamente cambie de idioma.

**Decisiones ya tomadas por el usuario** (sin más preguntas, ejecutar directo):
- Los 6 idiomas se traducen de una, no solo es/en.
- Sin ruteo por URL (`/en/dashboard`) — toda la app requiere login, no hay necesidad SEO. El idioma se resuelve del lado del servidor de forma invisible.

## Alcance de este spec (Fase 1 — el resto es Fase 2, spec/plan aparte)

1. Motor de i18n instalado y funcionando (`next-intl`, ya instalado y verificado contra el paquete real — API confirmada leyendo los `.d.ts`, no adivinada).
2. Resolución de idioma: usuario logueado → su preferencia; sin sesión (`/login`) → cookie de navegador, default español.
3. Un módulo piloto totalmente traducido a los 6 idiomas, de punta a punta, para validar el patrón antes de encarar las ~35 páginas restantes: **nav sidebar + `/dashboard` + `/account`**.
4. Las traducciones de es/en las escribo yo (con cuidado, son las que más se van a usar). Las 4 restantes (pt/fr/it/de) son un primer borrador generado por mí mismo como modelo — quedan marcadas explícitamente como "sin revisión humana nativa" en un comentario, dato real que hay que comunicarle al usuario antes de que esto llegue a un cliente real.

## A. Resolución de idioma — vía JWT, no una query nueva por request

Ya existe precedente exacto en el código: `activeEntityId`/`activeProfileId` viven en el JWT (`apps/web/lib/auth.ts`), refrescables sin re-login vía el trigger `update()` de Auth.js. `language` se agrega al mismo patrón:

- `jwt()` callback: al loguearse, `token.language = user.language` (ya viene del `authorize()` callback, que ya trae la fila completa de `users`).
- `session()` callback: `session.language = token.language as string`.
- `trigger === "update"`: si `"language" in session`, refrescar `token.language` — igual que ya hace con `activeEntityId`.
- La action existente `updateMyLanguageAction` (`apps/web/actions/account.actions.ts`) además de `updateUserLanguage(...)` en la DB, ahora también llama `unstable_update({ language: parsed.language })` para que el cambio de idioma sea inmediato, sin re-login — mismo mecanismo que ya usa el selector de entidad/perfil activo.

Esto evita agregar una query a Postgres en cada request solo para resolver el idioma (la misma lección de performance que ya aprendimos con el bug del proxy de sesión esta sesión) — el JWT ya trae todo lo necesario.

## B. Configuración de `next-intl` (sin segmento `[locale]`)

API real verificada contra el paquete instalado (`next-intl@4.13.2`, `node_modules/.pnpm/next-intl@.../dist/types/`):

- `apps/web/next.config.ts`: envolver la config con `createNextIntlPlugin()` de `next-intl/plugin`.
- `apps/web/i18n/request.ts` (nuevo): `getRequestConfig(async () => {...})` de `next-intl/server`. Como no hay segmento `[locale]`, el parámetro `requestLocale` que normalmente da el segmento de URL viene `undefined` siempre — el locale se resuelve manualmente ahí: `auth()` (ya existe en `lib/auth.ts`) → `session.language` si hay sesión; si no, `cookies().get("locale")?.value`; default `"es"` si ninguno aplica. Devuelve `{ locale, messages: (await import(`../messages/${locale}.json`)).default }`.
- `apps/web/app/layout.tsx` (root, ya existe): envolver `{children}` con `<NextIntlClientProvider>` (de `next-intl`, resuelve automáticamente RSC vs. client según el entorno de import) — necesario para que los Client Components (`token-form.tsx`, `language-form.tsx`, etc.) puedan usar `useTranslations()` además de los Server Components con `getTranslations()`.
- `/login` (sin sesión): agregar un selector de idioma chico en la página, que guarda en la cookie `locale` (no en DB, no hay usuario todavía) vía una Server Action mínima nueva.

## C. Estructura de mensajes

`apps/web/messages/{es,en,pt,fr,it,de}.json`, cada uno con namespaces por sección, empezando por los dos que cubre este piloto:

```json
{
  "nav": { "dashboard": "Dashboard", "account": "Mi cuenta", "assistance": "Asistencia", ... },
  "dashboard": { "title": "Dashboard", ... },
  "account": { "title": "Mi cuenta", "data": "Datos", "name": "Nombre", ... }
}
```

`es.json` es la fuente de verdad (texto ya existente, solo se extrae). Los otros 5 se traducen a partir de `es.json`.

## D. Migración del módulo piloto

- `apps/web/components/layout/nav-sidebar.tsx`: cada `label` hardcodeado pasa a `t("nav.xxx")` vía `getTranslations()` (es Server Component, confirmado sin `"use client"`).
- `apps/web/app/(central)/dashboard/page.tsx`: título y el texto de entidad/perfil activo.
- `apps/web/app/(central)/account/page.tsx` + sus 3 client components (`token-form.tsx`, `language-form.tsx`, `revoke-token-button.tsx`): mezcla de Server (`getTranslations`) y Client (`useTranslations`) — bueno como piloto porque ejercita ambos casos, que es exactomente lo que el resto de la app va a necesitar en la Fase 2.

## E. Testing

- Unit: `apps/web/i18n/request.ts`'s lógica de resolución (con sesión → `session.language`; sin sesión + cookie → cookie; sin ninguno → `"es"`) — función pura extraíble y testeable sin necesitar next-intl corriendo.
- E2E: extender `e2e/specs/account.spec.ts` con un caso que cambia el idioma a `"en"`, recarga, y confirma que el nav sidebar y el título de Dashboard efectivamente aparecen en inglés (no solo que el `<select>` guardó el valor, que es lo que ya prueba el test existente).

## Fuera de alcance (Fase 2, spec/plan aparte)

- Las ~35 páginas restantes (Asistencia, Activos, Gestión, Herramientas, Administración, Configuración, Portal) — mecánico pero grande, buen candidato para paralelizar con subagentes una vez que este piloto valide el patrón.
- Revisión humana nativa de pt/fr/it/de antes de que esto se considere "listo para vender a un cliente real" — las traducciones de esta fase son un primer borrador, no verificadas por un hablante nativo.
- Formato de fechas/números localizado (`next-intl` lo soporta vía `getFormatter()`, pero no se toca en este piloto — los `toLocaleString()` ya existentes quedan como están por ahora).
