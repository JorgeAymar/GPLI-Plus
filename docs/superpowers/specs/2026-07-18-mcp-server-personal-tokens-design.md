# Servidor MCP + tokens personales de usuario

## Contexto y objetivo

El usuario pidió que la app funcione como **servidor MCP** (Model Context Protocol), y que cada usuario pueda crear su propio token de acceso desde una página de perfil personal, para conectar clientes MCP (Claude Desktop, Claude Code, etc.) contra su instancia de la app.

Hoy existe un sistema de tokens bearer (`/setup/api-clients`, tabla `api_clients`) pero es **a nivel de entidad**, administrado por un admin — un token no tiene dueño personal, y respalda `/api/v1/[itemtype]`, que es **de solo lectura a propósito**: el código documenta explícitamente que no se implementó escritura porque no había un usuario real a quien atribuir la acción (ver comentario en `apps/web/app/api/v1/[itemtype]/route.ts`).

Un token **personal** (atado a un `userId`) resuelve ese problema de raíz: el dueño del token ES el usuario, así que en teoría se podría escribir atribuyendo la acción a él. Aun así, este diseño se limita a **solo lectura para v1** (decisión explícita del usuario) — escritura queda fuera de alcance, ver "Fuera de alcance" al final.

### Desambiguación de nombres importante

La app ya usa "Perfil" (`/administration/profiles`) para **roles RBAC** (Super-Admin, etc.), sin relación con "perfil personal de usuario". Para no chocar esa palabra, la página nueva se llama **"Mi cuenta"** en la UI y vive en la ruta **`/account`** (no `/profile`).

## Alcance de esta spec

1. Extender `api_clients` para soportar tokens personales (`userId`), sin tocar el modelo de tokens de entidad existente.
2. Endpoint de servidor MCP (`/api/mcp`) usando el SDK oficial `@modelcontextprotocol/sdk`, autenticado con esos tokens personales.
3. Tools MCP de solo lectura, generadas desde `ITEMTYPE_REGISTRY` (ya existente) — no hay lista hardcodeada por tipo.
4. Página `/account` ("Mi cuenta") donde el usuario logueado crea/lista/revoca sus propios tokens.
5. Selector de idioma preferido en la misma página `/account` (sección F) — guarda la preferencia, no traduce la app todavía (ver "Fuera de alcance").
6. Tests unitarios + E2E cubriendo el flujo completo.

## Fuera de alcance (explícitamente, no es un olvido)

- **Escritura vía MCP** (crear/actualizar tickets, etc.) — el usuario eligió solo-lectura para v1. Queda documentado como follow-up natural una vez validado el flujo de lectura, reusando el mismo `userId` como actor.
- **Selección de entidad activa por el usuario dueño del token** — el token siempre usa la entidad/perfil *default* del usuario (igual que el fallback que ya usa `resolveAuthContext` en el login), no una que el usuario elija al crear el token. Si el usuario tiene múltiples asignaciones entidad/perfil, el MCP siempre ve la marcada `isDefault`.
- **Un servidor MCP por token con más de un `Authorization` scheme** — solo Bearer, igual que `/api/v1` hoy.
- **Rate limiting / auditoría específica de MCP** más allá de lo que ya existe (`lastUsedAt`, `audit_log` no se toca porque no hay escritura).
- **Motor de i18n real** (que la app efectivamente renderice en el idioma elegido) — es un subsistema propio e independiente (librería de i18n, extracción de todos los strings hoy hardcodeados en español, propagación del locale) que toca prácticamente todas las páginas de la app. Se dimensiona y diseña por separado, en su propia spec, después de este feature. Esta spec solo guarda la preferencia (sección F) para que ese trabajo futuro tenga de dónde leerla.

## A. Modelo de datos

Extender la tabla existente `api_clients` (`packages/db/src/schema/api-clients.ts`) en vez de crear una tabla paralela — reutiliza tal cual `createApiClient`/`verifyApiKey`/`revokeApiClient` (mismo bcrypt+prefijo indexado, mismo soft-revoke).

Cambios de columna:

```ts
export const apiClients = pgTable(
  "api_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Ahora nullable: los tokens personales no fijan una entidad al crearse
    // (ver sección B) - se resuelve en cada request desde el usuario.
    entityId: uuid("entity_id").references(() => entities.id),
    // NUEVO. Nullable - null significa "token de entidad" (comportamiento
    // actual sin cambios); no-null significa "token personal de ese usuario".
    userId: uuid("user_id").references(() => users.id),
    name: text("name").notNull(),
    apiKeyHash: text("api_key_hash").notNull(),
    apiKeyPrefix: text("api_key_prefix").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("api_clients_entity_idx").on(table.entityId),
    index("api_clients_user_idx").on(table.userId),
    index("api_clients_prefix_idx").on(table.apiKeyPrefix),
    check("api_clients_entity_xor_user", sql`(entity_id IS NOT NULL) != (user_id IS NOT NULL)`),
  ],
);
```

Invariante forzada a nivel de **base de datos** (constraint `CHECK`, no solo validación en el service): **exactamente uno de `entityId`/`userId` está seteado**, nunca ambos, nunca ninguno. Un bug futuro en el código no puede dejar una fila en un estado inconsistente.

- `createApiClient({ entityId, name, scopes })` (firma actual, sin cambios) → sigue creando tokens de entidad.
- `createPersonalApiClient({ userId, name })` (nueva función en el mismo archivo `api-client-service.ts`) → crea con `userId` seteado, `entityId: null`, `scopes: []` (no se usa `scopes` para tokens personales, ver sección B), prefijo `pat_` en vez de `sk_` (para que un operador distinga a simple vista un token personal de uno de entidad).
- Migración Drizzle: `pnpm db:generate` + `pnpm db:migrate`, no destructiva (columnas nuevas nullable, `entityId` pasa de NOT NULL a nullable sin perder datos existentes).

## B. Autorización

Los tokens de entidad siguen usando `hasScope(client, moduleKey)` contra su array `scopes` (sin cambios).

Los tokens personales **no usan `scopes` en absoluto**. En cada llamada a una tool MCP:

1. Resolver `AuthContext` real: `resolveAuthContext({ userId: client.userId, activeEntityId: null, activeProfileId: null })` (mismo `resolveAuthContext` de `packages/core/src/auth/get-auth-context.ts`, mismo fallback a la asignación `isDefault` que ya usa el login).
2. Si devuelve `null` (usuario borrado/desactivado desde que se creó el token) → 401 a nivel de conexión MCP, igual que el proxy web ya hace con `isActiveUserId`.
3. Por tool: `requireRight(context, entry.moduleKey, RIGHT.READ)` (mismo `requireRight` que ya usa toda la UI). Si falla, la tool individual devuelve `isError: true` con el mensaje de `ForbiddenError` — **no** mata la conexión MCP entera, porque otras tools sí pueden ser válidas para ese usuario.

Resultado: un token personal nunca puede leer más de lo que ese usuario ya puede leer logueado normalmente en la web. No se inventa un sistema de permisos paralelo.

## C. Endpoint MCP

Nuevo archivo `apps/web/app/api/mcp/route.ts`, usando el SDK oficial `@modelcontextprotocol/sdk` (nueva dependencia en `apps/web/package.json`) con el transporte **Streamable HTTP** (`StreamableHTTPServerTransport`), que es el transporte estándar para "remote MCP server" (lo que usan Claude Desktop/Claude Code al conectar un conector remoto por URL).

- `/api/mcp` ya queda excluido del proxy de sesión humana automáticamente: el matcher de `apps/web/proxy.ts` es `/((?!api|_next/static|_next/image|favicon.ico).*)`, que excluye **todo** `/api/**` (igual que `/api/v1` hoy) - no hace falta tocar el proxy.
- Autenticación: mismo header `Authorization: Bearer <token>` que `/api/v1`, resuelto con `verifyApiKey()` (sin cambios). Si `client.userId` es `null` (o sea, es un token de **entidad**), rechazar con 401 explícito: *"Este token es de entidad, no personal. Los tokens MCP se crean desde /account."* — un token de entidad nunca debe poder pegarle al endpoint MCP.
- **Sin estado de sesión entre requests**: dado que v1 es 100% solo-lectura y sin necesidad de mantener contexto conversacional del lado del servidor, el transporte se instancia en modo *stateless* (sin `sessionIdGenerator`, cada request HTTP es independiente) - evita construir un almacén de sesiones MCP que no hace falta todavía.
- Actualiza `lastUsedAt` del `ApiClient` en cada request autenticado exitoso (reusa la misma actualización que ya hace `verifyApiKey`).

## D. Tools MCP (generadas desde `ITEMTYPE_REGISTRY`)

`packages/core/src/api-clients/itemtype-registry.ts` ya lista 5 tipos (`tickets`, `assets`, `computers`, `problems`, `changes`) con `moduleKey` + `list(entityId)` + `get?(id)` opcional. El endpoint MCP itera ese registro en el momento de registrar tools contra el `McpServer` del SDK - **no hay una tool hardcodeada por itemtype**; si mañana se agrega una entrada al registro, aparece automáticamente como tool sin tocar `/api/mcp`.

Por cada entrada `key` del registro:

- **`list_<key>`** (ej. `list_tickets`): sin argumentos. Internamente: resolver contexto → `requireRight(context, entry.moduleKey, RIGHT.READ)` → `entry.list(context.activeEntity.id)` (con `includeSubtree: true`, igual que hoy). Devuelve el array como JSON en el `content` de la tool result.
- **`get_<key>`** (ej. `get_ticket`): un argumento `{ id: string }` (Zod: `z.object({ id: z.string().uuid() })`, usando el mismo `zodToJsonSchema`-style que ya soporta el SDK de MCP para `inputSchema`). Solo se registra si `entry.get` existe (hoy todos los 5 lo tienen). 404 → tool result con `isError: true` y mensaje "no encontrado", no una excepción no controlada.

v1: 5 itemtypes × (list + get) = **9 tools**.

Descripciones de cada tool (campo `description` que ve el modelo cliente) generadas desde una plantilla simple ("Lista los tickets de tu entidad activa (incluye subárbol)." / "Obtiene un ticket por id."), no texto libre por tipo - mantiene el registro como única fuente de verdad.

## E. Página "Mi cuenta" (`/account`)

Nueva ruta `apps/web/app/(central)/account/page.tsx` (Server Component, requiere `requireAuthContext()` igual que el resto de `(central)/**`), con:

- Datos de solo lectura: nombre, email, entidad/perfil activo actual.
- Sección "Tokens MCP": tabla de tokens propios (`listMyApiClients(userId)` → filtra `api_clients` por `userId = context.user.id`), con nombre, prefijo, fecha de creación, último uso, botón "Revocar".
- Form "Crear token": un solo campo `name` (ej. "claude-desktop"), botón "Crear". Al crear, muestra el `rawKey` completo **una sola vez** en pantalla (mismo patrón ya probado en `/setup/api-clients` - "revela la key una sola vez"), con instrucción de copiarlo porque no se vuelve a mostrar.
- Enlace nuevo en `nav-sidebar.tsx`: "Mi cuenta" (visible para cualquier usuario logueado, no depende de un `MODULE.*` right - es autogestión de la propia cuenta).

Server actions nuevas en `apps/web/actions/account.actions.ts`:

- `listMyApiClientsAction()` → `requireAuthContext()` + `listMyApiClients(context.user.id)`.
- `createMyApiClientAction(name: string)` → `requireAuthContext()` + `createPersonalApiClient({ userId: context.user.id, name })`. Sin `requireRight` adicional - crear tu propio token no es un permiso RBAC, cualquier usuario autenticado puede autogestionar su propio acceso MCP.
- `revokeMyApiClientAction(id: string)` → `requireAuthContext()` + verifica ownership (`client.userId === context.user.id`, si no 403/not-found genérico) antes de `revokeApiClient(id)` - evita que un usuario revoque el token de otro adivinando su id.

## F. Idioma preferido (solo la preferencia, no el motor de traducción)

La tabla `users` **ya tiene** una columna `language` (`text`, default `"es"`) — existe desde una fase anterior pero hoy no la lee ni la escribe nada en todo el código (confirmado por búsqueda: cero referencias). No hace falta migración para esta parte, solo conectar lo que ya existe:

- En `/account`: selector (`<select name="language">`) con las opciones `es` ("Español") / `en` (English) - mismo patrón de `<select>` que ya usan otros forms del repo (ej. `change-form.tsx`). Value actual = `context.user.language`.
- Nueva server action `updateMyLanguageAction(language: "es" | "en")` en `account.actions.ts` → `requireAuthContext()` + valida con un `z.enum(["es", "en"])` (mismo estilo Zod que el resto del repo) + `UPDATE users SET language = $1 WHERE id = $2` (nueva función chica `updateUserLanguage(userId, language)` en `packages/core/src/users/user-service.ts`, mismo archivo que ya tiene `stampLastLogin`) + `revalidatePath("/account")`.
- **No hace nada más todavía**: guardar la preferencia no cambia ningún texto de la UI en esta spec. Eso es el motor de i18n, fuera de alcance (ver arriba) - queda documentado ahí como el próximo proyecto natural, y ese proyecto futuro ya tiene de dónde leer el idioma de cada usuario sin tener que diseñar el storage de nuevo.

## G. Testing

- **Unit** (`packages/core`): `createPersonalApiClient` (prefijo `pat_`, `entityId` null, `userId` seteado), `isActiveUserId` reuso, autorización de tool simulada (usuario sin el right correspondiente → `ForbiddenError`), `updateUserLanguage` (rechaza valores fuera de `es`/`en`).
- **Unit** (`apps/web`, si aplica sobre helpers puros de mapeo registro→tool).
- **E2E** (`e2e/specs/account.spec.ts`, nuevo): login → ir a `/account` → crear token → ver key revelada una vez → revocar → confirma que desaparece de la lista tras recargar; cambiar el selector de idioma a `en` → recargar → sigue en `en`.
- **E2E o script de integración para el endpoint MCP**: llamar `/api/mcp` con un cliente MCP real (`@modelcontextprotocol/sdk`'s `Client` + `StreamableHTTPClientTransport`) contra el token recién creado, listar tools (confirma que aparecen las 9), invocar `list_tickets` y `get_ticket` con datos sembrados, y confirmar que un token de **entidad** (existente) es rechazado con 401 en `/api/mcp`.

## Checklist de implementación (alto nivel, se detalla en el plan)

1. Migración de schema (`api_clients`: `entityId` nullable, `+userId`, índice, check constraint).
2. `createPersonalApiClient` + `listMyApiClients` + ownership check en revoke + `updateUserLanguage` (packages/core).
3. Dependencia `@modelcontextprotocol/sdk` + `apps/web/app/api/mcp/route.ts` (auth + registro dinámico de tools desde `ITEMTYPE_REGISTRY`).
4. Página `/account` + `account.actions.ts` (tokens + selector de idioma) + entrada en `nav-sidebar.tsx`.
5. Tests (unit + e2e) según sección G.
6. Actualizar `docs/architecture-plan.md` con el nuevo módulo, como ya es la convención del repo.
