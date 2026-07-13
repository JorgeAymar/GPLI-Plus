# @itsm/web

Next.js 16 (App Router + Turbopack). UI, Server Actions y Auth.js. Consume `@itsm/core` (servicios de negocio) y `@itsm/db` (solo para el adapter de Auth.js) — nunca implementa lógica de negocio directamente en un componente o Server Action.

> Antes de escribir código aquí, lee `AGENTS.md` — Next.js 16 tiene cambios que rompen con versiones anteriores (ej. `middleware.ts` → `proxy.ts`). Los docs actualizados de la versión instalada están en `node_modules/next/dist/docs/`.

## Rutas (route groups)

- `app/(auth)/` — layout sin sidebar. Login.
- `app/(central)/` — shell principal: sidebar (`components/layout/nav-sidebar.tsx`) + selector de entidad/perfil activo (`components/layout/context-switcher.tsx`). Todas las páginas admin/operativas viven acá.
- `app/(simplified)/portal/` — shell de autoservicio (creación simplificada de tickets + "Mis solicitudes"), completo desde Fase 3c.

`proxy.ts` (antes `middleware.ts`, renombrado en Next.js 16) protege todo excepto `/login` y **excluye `/api/**`** de su matcher — corre siempre en runtime Node.js (ya no es configurable) porque `lib/auth.ts` importa el adapter de Drizzle/`pg` a nivel de módulo, que no es edge-compatible.

`app/page.tsx` (la raíz `/`) redirige según `context.activeProfile.interface`: `/portal` si es `simplified`, `/dashboard` en cualquier otro caso (incluida la ausencia de sesión, donde `proxy.ts` ya redirigió a `/login` antes de llegar acá).

## Patrón de página (Server Component + form client)

Cada página de listado/creación sigue el mismo layout de dos columnas — ver `app/(central)/administration/entities/page.tsx` como referencia:

```tsx
export default async function XPage() {
  const items = await listX(...);       // fetch server-side vía @itsm/core
  return (
    <div className="grid grid-cols-2 gap-8">
      <div>{/* listado existente */}</div>
      <div><XForm /* props */ /></div>  {/* client component */}
    </div>
  );
}
```

El form (`"use client"`) usa `useActionState` de React 19 + un wrapper `action()` local que llama la Server Action real y atrapa errores en `{ error?: string }`:

```tsx
async function action(_prev, formData) {
  try { await createXAction({...}); return {}; }
  catch (err) { return { error: err instanceof Error ? err.message : "Error desconocido" }; }
}
```

## Server Actions (`actions/*.actions.ts`)

Todas siguen el mismo esqueleto (ver `actions/entities.actions.ts`):

```ts
"use server";
export async function createXAction(input) {
  const context = await requireAuthContext();               // lib/session.ts
  await requireRight(context, MODULE.X, RIGHT.CREATE);       // @itsm/core
  const parsed = createXSchema.parse(input);                  // @itsm/core
  const x = await createX(parsed, context.user.id);           // @itsm/core
  revalidatePath("/ruta-afectada");
  return x;
}
```

Para acciones sobre un recurso ya existente (update/assign/delete/purge), primero hay que resolver a qué módulo pertenece antes de chequear el permiso — ver `requireRightForAsset()`/`requireRightForAssetDefinition()` en `actions/assets.actions.ts` como ejemplo de este patrón cuando el módulo depende de un campo del recurso (ej. el tipo de activo). El mismo principio aplica a features cross-módulo como adjuntos: `actions/documents.actions.ts` resuelve el módulo desde un mapa `ITEM_TYPE_MODULE: Record<itemType, MODULE_KEY>` en vez de tener un módulo propio para "documentos".

**Subida de archivos**: la Server Action recibe `FormData` (no un objeto tipado) porque incluye un `File` — ver `uploadDocumentAction(formData, revalidatePathTarget)`. El Client Component arma el `FormData` con `formData.set("itemType", ...)` antes de invocar la acción; el archivo se convierte a `Buffer` recién adentro de la Server Action (`Buffer.from(await file.arrayBuffer())`), nunca en el cliente.

## Componentes reusables cross-módulo (`components/<dominio>/`)

Cuando una feature se reusa en más de una página (no solo dentro de un módulo), vive en `components/<dominio>/` en vez de junto a una sola página — ej. `components/itil/` (compartido por Ticket/Problem/Change) y `components/documents/attachments-section.tsx` (`<AttachmentsSection itemType itemId revalidatePathTarget />`, wireado hoy en Ticket y Computer, extensible a cualquier página agregando una entrada a `ITEM_TYPE_MODULE`).

## Rutas API (`app/api/`, bearer token — no sesión JWT)

Dos familias de rutas bajo `app/api/`, ambas fuera del matcher de `proxy.ts` (ver arriba), cada una con su propia validación:
- `app/api/v1/[itemtype]/route.ts` + `[itemtype]/[id]/route.ts` — API REST pública, valida `Authorization: Bearer <key>` con `verifyApiKey()` de `@itsm/core` (nunca `requireAuthContext()`/sesión humana), resuelve un "contexto API" (entityId + scopes) distinto del `AuthContext` de sesión.
- `app/api/documents/[id]/route.ts` — descarga de adjuntos, sí requiere sesión (`getAuthContext()`, no `requireAuthContext()` porque un route handler no puede `redirect()` como una página — hay que devolver un `Response` 401 a mano si no hay contexto).

Regla general: un route handler nunca debe dejar que `requireAuthContext()`/`requireRight()` exploten sin capturar — a diferencia de una página (donde tirar `notFound()`/dejar que el error propague está bien), acá hay que devolver un `Response` con el status code correcto.

## Auth (`lib/auth.ts`, `lib/session.ts`)

Sesión **JWT**, no DB — el proveedor Credentials de Auth.js no soporta sesiones en base de datos. "Cambiar entidad/perfil activo sin re-login" se implementa con el trigger `update()` (`unstable_update`, exportado desde `lib/auth.ts`), no con una fila de sesión mutable.

`lib/session.ts` expone `getAuthContext()`/`requireAuthContext()`, memoizados por request con `cache()` de React — resuelven usuario + entidad activa + perfil activo desde el JWT, tocando la base de datos como máximo una vez por request sin importar cuántos Server Components lo llamen.
