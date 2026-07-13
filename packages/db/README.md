# @itsm/db

Esquema de base de datos (Drizzle ORM sobre PostgreSQL) y migraciones. **Agnóstico de framework** — no depende de Next.js ni de Auth.js más allá del *shape* de tablas que Auth.js's DrizzleAdapter espera (`users`, `accounts`, `sessions`, `verification_tokens`).

## Convenciones

- Un archivo por concern en `src/schema/`, reexportado desde `src/schema/index.ts`.
- PK: `uuid("id").primaryKey().defaultRandom()` en todas las tablas (excepto tablas de extensión 1:1, que comparten PK con la tabla base — ver `computers`/`network_equipment` en Fase 2b).
- Columnas: nombre TS camelCase, nombre de columna Postgres snake_case explícito: `entityId: uuid("entity_id")`.
- Timestamps: `createdAt`/`updatedAt` con `timestamp("...", { mode: "date" }).notNull().defaultNow()`.
- FK auto-referencial: patrón `parentId: uuid("parent_id").references((): AnyPgColumn => tabla.id)`.
- Cada tabla exporta `type X = typeof tabla.$inferSelect` y `NewX = typeof tabla.$inferInsert`.
- Toda tabla entity-scoped tiene `entityId: uuid("entity_id").notNull().references(() => entities.id)`.
- Tipos Postgres sin soporte nativo en Drizzle (como `ltree`) se definen con `customType` — ver `entities.ts`. Es el único uso de `ltree` en todo el schema (jerarquía de Entidades); otros árboles (`groups`, `dropdown_items`, `kb_categories`) usan un simple `parentId` auto-referencial sin path materializado, porque no necesitan queries de subárbol O(index) — alcanza con recorrer en la capa de servicio.
- **Polimorfismo sin FK** (`kind` enum + `id` uuid suelto, sin `.references()`): patrón para "esto puede apuntar a más de un tipo de tabla" — ver `itilActors.actorKind/actorId` (user/group/supplier), `resourceVisibilityRules.granteeKind/granteeId` (user/group/profile/entity), `projectTeamMembers.memberKind/memberId`. Se usa en vez de columnas `itemType`+`itemId` genéricas cuando el discriminador tiene un conjunto fijo y chico de valores con semántica propia (rol/tipo de relación), no un `itemType` libre.
- **Polimorfismo por discriminador libre** (`itemType: text` + `itemId: uuid`, también sin FK): para "esto puede adjuntarse a cualquier entidad del sistema, sin lista cerrada" — ver `documentItems.itemType/itemId` (adjuntos) e `itilTimelineItems`/`ruleCriteria` (aunque estos son de un solo dominio). Siempre con un índice compuesto `(itemType, itemId)` para el lookup inverso.
- **Tabla de unión con PK compuesta** (sin `id` propio): para relaciones N:M puras sin atributos propios más allá de la relación — ver `contractAssets`, `clusterMembers`, `primaryKey({columns:[a,b]})`.
- **`jsonb` para config libre por fila**: cuando un tipo necesita campos que varían por instancia sin migración (ej. `dashboardCards.options` para `{chartType}`, `assets.customFields` validado dinámicamente en la capa de servicio) — nunca se valida en el schema, siempre en `packages/core` antes de escribir.

## Migraciones

```bash
pnpm db:generate   # genera SQL a partir del diff de schema (packages/db/migrations/)
pnpm db:migrate    # aplica migraciones pendientes contra DATABASE_URL
```

La migración inicial (`0000_stiff_stick.sql`) necesita `CREATE EXTENSION IF NOT EXISTS "ltree";` antes del primer `CREATE TABLE` que la usa — drizzle-kit no genera extensiones automáticamente, así que si agregas un nuevo tipo Postgres nativo (`customType`) que dependa de una extensión, agrega el `CREATE EXTENSION` a mano en la migración generada.

## Por qué no depende de `next-auth`

`packages/db/src/schema/auth.ts` NO importa tipos de `next-auth/adapters` (aunque el shape de las tablas coincide con lo que Auth.js espera) — pnpm con node_modules estricto no deja ver `next-auth` desde este paquete porque no lo declara como dependencia, y no debería: es un paquete de schema, no de autenticación. La columna `accounts.type` es un `text` simple, no tipado con `AdapterAccountType`.
