# @itsm/core

Capa de servicios de negocio: funciones async planas (sin clases) que envuelven `@itsm/db`, validación Zod, y el sistema de permisos (RBAC). **Agnóstico de framework** — no importa nada de Next.js ni Auth.js; `apps/web` es quien conecta esto con sesiones/Server Actions.

## Convenciones

- Un archivo por dominio en `src/<dominio>/<dominio>-service.ts` (ej. `src/entities/entity-service.ts`).
- Validación Zod en `src/validation/<dominio>.zod.ts`, exportando `createXSchema`/`updateXSchema` + tipos inferidos `CreateXInput`.
- Todo lo público se reexporta desde `src/index.ts`.
- Después de un `insert()...returning()` o `update()...returning()`, siempre verificar que la fila destructurada no sea `undefined` antes de retornarla (`tsconfig.base.json` tiene `noUncheckedIndexedAccess: true`, así que TypeScript lo exige):
  ```ts
  const [created] = await db.insert(tabla).values({...}).returning();
  if (!created) throw new Error("...");
  return created;
  ```

## RBAC

- `src/auth/permissions.ts`: bitmask `RIGHT` (`READ=1, CREATE=2, UPDATE=4, DELETE=8, PURGE=16, APPROVE=32, ASSIGN=64`) + `requireRight(context, moduleKey, required)` que lanza `ForbiddenError`.
- `src/auth/modules.ts`: constantes `MODULE.*` (strings con puntos, ej. `"assets.computer"`) usadas como `profile_module_rights.module_key`. Los tipos de activo **custom** (creados por un admin, `isSystem = false`) comparten `MODULE.ASSETS_GENERIC` en vez de necesitar una constante nueva por tipo — ver `moduleKeyForAssetDefinition()` en `assets/asset-definition-service.ts`.
- `src/auth/get-auth-context.ts`: `resolveAuthContext(rawSession)` resuelve usuario + entidad activa + perfil activo desde una sesión "cruda" (`{userId, activeEntityId, activeProfileId}`) — no sabe de dónde viene esa sesión (Auth.js/JWT es cosa de `apps/web/lib/auth.ts`).

## Agregar un módulo nuevo (ej. Fase 3 Tickets)

1. Schema en `packages/db/src/schema/` + migración.
2. Servicio en `src/<dominio>/<dominio>-service.ts` (seguir el patrón de `asset-service.ts`: `create`/`list`/`get`/`update`, más acciones separadas para bits de permiso específicos como `assign`/`delete`/`purge`).
3. Nuevas claves en `MODULE` (`src/auth/modules.ts`).
4. Zod schemas en `src/validation/`.
5. Reexportar todo desde `src/index.ts`.
6. En `apps/web`: Server Action en `actions/<dominio>.actions.ts` que hace `requireAuthContext()` → `requireRight()` → llama al servicio → `revalidatePath()`.

## Patrón adapter (interfaz + una sola implementación real)

Para "cómo se entrega/guarda esto en el mundo real" cuando queremos poder cambiar el backend sin tocar la lógica de negocio: una interfaz chica + una implementación concreta hoy, documentada como swappable.

- `src/notifications/transport.ts` — `NotificationTransport.send()`, hoy solo `ConsoleTransport` (un `SmtpTransport` real se agregaría sin tocar `notification-service.ts`).
- `src/storage/storage-adapter.ts` — `StorageAdapter.save/read/delete()`, hoy solo `LocalFsAdapter` (`STORAGE_DRIVER=local`); `S3Adapter` está documentado en `docs/architecture-plan.md` pero no construido (sin bucket/credenciales contra qué probarlo).

## Patrón registro (`Record<string, fn>` en vez de un archivo por tipo)

Para mapear un identificador de texto (guardado en DB o elegido por el usuario) a una función ya existente, sin necesitar una tabla/archivo nuevo por cada variante:

- `src/dashboards/card-provider.ts` — `CARD_PROVIDERS: Record<CardKey, (entityId) => Promise<unknown>>` mapea el `cardKey` de una card de dashboard a la función de `report-service.ts` que trae sus datos.
- `src/saved-searches/saved-search-service.ts` — `COUNT_RESOLVERS` mapea `itemType` → función de conteo, para las alertas de búsquedas guardadas.
- `src/api-clients/itemtype-registry.ts` — `ITEMTYPE_REGISTRY` mapea el nombre de tipo en la URL (`/api/v1/tickets`) a `{moduleKey, list, get}` de los servicios ya existentes — la API REST no reimplementa nada, solo expone lo que ya hay.

## Motor de reglas genérico (`src/rules/rule-engine.ts`)

Un solo motor (`rules`/`rule_criteria`/`rule_actions`, `ruleType` como string libre) reusado por cualquier dominio que necesite "si estas condiciones se cumplen, aplicá estas acciones" — hoy: `asset_import` (Inventory, Fase 6b) y `right_assignment` (LDAP, Fase 6g). `evaluateRules(ruleType, entityId, input)` retorna `{output, matchedRuleIds}`; agregar un dominio nuevo es solo llamar `evaluateRules("mi_dominio", ...)` con el vocabulario de `field` que tenga sentido para ese dominio — no hace falta tabla ni servicio nuevo.

## Visibilidad restringida (`src/visibility/visibility-service.ts`)

Para "quién más puede ver esto" sin replicar 4 tablas pivote (user/group/profile/entity) por cada módulo — una sola tabla genérica `resource_visibility_rules` (`resourceType` string + `resourceId`) y `isResourceVisibleTo(resourceType, resourceId, ownerUserId, context)`. Reusado por Knowledge Base, RSS Feed y Dashboards; para agregarlo a un módulo nuevo, filtrar la lista de candidatos con `isResourceVisibleTo()` en vez de escribir un join de permisos propio.

## Auth de API (bearer token, distinto del JWT de sesión humana)

`src/api-clients/api-client-service.ts` — `verifyApiKey(rawKey)` resuelve un cliente API (scopes = `MODULE.*` keys) a partir de un header `Authorization: Bearer sk_...`, sin relación con `resolveAuthContext()`/JWT de `apps/web`. Las rutas bajo `apps/web/app/api/v1/` quedan fuera del `matcher` de `proxy.ts` a propósito y hacen su propia validación — ver `apps/web/README.md`.

## Scripts

```bash
pnpm --filter @itsm/core seed   # packages/core/scripts/seed.ts - idempotente, seguro de re-correr
```

El seed crea/asegura: entidad raíz "Global", perfil "Super-Admin" con todos los `RIGHT` en todos los `MODULE`, usuario admin (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, default `admin@itsm.local`/`ChangeMe123!`), los 6 tipos de activo core, y categorías/items de dropdown base.
