# Reporte de QA: testing, auditoría de librerías, hardcodeo e índices

Resultado del pase de QA solicitado: exploración completa de la app, construcción de una suite de tests real (antes inexistente), auditoría de librerías desactualizadas, auditoría de valores hardcodeados, y auditoría de índices de base de datos — con cada bug real encontrado corregido en el momento, no solo documentado.

**Estado final de esta ronda: 679/679 tests unitarios (Vitest) + 149/149 tests E2E (Playwright) pasando, en corrida aislada.** Pipeline completo (`lint`+`typecheck`+`test`+`build`) verde en los 4 paquetes. Todo commiteado y pusheado a [github.com/JorgeAymar/GPLI-Plus](https://github.com/JorgeAymar/GPLI-Plus).

> Nota: este reporte es un snapshot de esa ronda específica de QA, no se reescribe con cada cambio posterior. Una ronda posterior (fix de un bug real de redirect-loop + la feature de tokens MCP personales) subió el total a 690 tests unitarios + 152 E2E — ver `architecture-plan.md`, sección "Tercera ronda", para el detalle actualizado.

---

## 1. Infraestructura de testing agregada

Antes de este pase: Vitest configurado en los 4 paquetes pero corriendo con `--passWithNoTests` (cero archivos `.test.ts` en todo el repo), y Playwright ni siquiera era una dependencia instalada.

- **Playwright 1.61** agregado como dependencia real + `playwright.config.ts` (proyecto único `chromium`, `workers: 1` para no correr specs en paralelo contra la misma Postgres de dev) + `e2e/auth.setup.ts` (login real vía el form HTML, `storageState` reusado por todos los specs).
- **`packages/core/vitest.config.ts` + `vitest.setup.ts`** (nuevos): sin esto, cualquier conexión a `localhost:5436` colgaba indefinidamente en este entorno (Node resolvía `localhost` a `::1` primero); además `fileParallelism: false` porque varios servicios tocan tablas globales no scoped por entidad (`ticket_field_definitions`, `notification_templates`).
- Scripts nuevos: `pnpm e2e` (correr specs) y `pnpm e2e:report` (ver el reporte HTML).

## 2. Cobertura agregada

- **672 tests Vitest**: un archivo por servicio de `packages/core` + su validación Zod correspondiente, contra Postgres real (sin mocks, mismo patrón de prefijo-de-nombre + limpieza en `afterAll` que ya usaban los scripts de verificación desechables de este proyecto).
- **149 tests Playwright**: un spec por sección del sidebar (Asistencia, Activos, Gestión, Herramientas, Administración, Configuración, Portal), cubriendo cada página, cada tipo de campo de formulario (validado con la propiedad `type` real del DOM, no solo el JSX), y un flujo E2E completo de creación/edición por entidad representativa de cada módulo.

## 3. Bugs reales encontrados y corregidos

Cada uno de estos tiene un escenario de fallo concreto y reproducible — no son hallazgos cosméticos.

| # | Archivo | Bug | Fix |
|---|---|---|---|
| 1 | `packages/core/src/assets/dynamic-schema.ts` | `z.coerce.boolean()` acepta el string `"false"` como `true` (`Boolean("false") === true` en JS); un booleano requerido ausente pasaba validación en silencio | `z.preprocess()` que interpreta `"true"/"1"`→true, `"false"/"0"`→false, deja pasar el resto a la validación normal |
| 2 | `packages/core/src/itil/ticket-field-service.ts` | Mismo bug de booleanos, duplicado de forma independiente en el Form Builder de Tickets | Mismo fix replicado |
| 3 | Ambos archivos de arriba | Un campo de texto/textarea **requerido** aceptaba string vacío `""` como válido | Agregado `.min(1, "Este campo es requerido")` cuando `isRequired` |
| 4 | `packages/core/src/dashboards/card-provider.ts` | La tarjeta "Cumplimiento de SLA" **siempre** mostraba "Sin datos." — `getSlaComplianceRate()` devuelve un objeto único, el código asumía array incondicionalmente | `normalizeForChart`/`TableView` corregidos para manejar la forma objeto; de paso se agregaron 2 etiquetas de card faltantes y se sumó `tickets_created_by_day` al switch de gráfico de barras/torta |
| 5 | 10 archivos en `apps/web/actions/*.actions.ts` (dropdowns, api-clients, asset-definitions, etc.) | `schema.parse()` (no `.safeParse()`) hace que `ZodError#message` sea un JSON crudo — se mostraba tal cual al usuario en **cualquier** error de validación de todo el módulo de Configuración | Helper `parseInput()` (`.safeParse` + mensajes de error unidos por `; `) en cada archivo |
| 6 | `apps/web/actions/{entities,users,groups,profiles}.actions.ts` | Ninguna de las 6 acciones de mutación de Administración llamaba `recordAuditLog` — el módulo entero era invisible en el log de auditoría | Wireado en las 6 acciones, con cuidado explícito de excluir `passwordHash` del payload logueado |
| 7 | `apps/web/actions/{assets,software}.actions.ts` | `revalidatePath()` apuntaba a `/assets` en vez de `/assets/${definition.key}` (o al equivalente en software) — la UI quedaba desactualizada hasta un refresh manual | Agregado el `revalidatePath` de la ruta real donde vive la lista |
| 8 | `ticket-form.tsx`, `problem-form.tsx`, `change-form.tsx` | Los 3 forms de creación **nunca exponían** urgencia/impacto/prioridad/categoría, pese a que el schema y la validación sí los soportan — todo registro quedaba silenciosamente en los valores por defecto | Campos agregados a los 3 forms + línea de solo-lectura en las 3 páginas de detalle (antes: escribible pero invisible) |
| 9 | `recurring-ticket-form.tsx` | El campo `intervalMinutes` no tenía `required`, produciendo `Number("") = 0` y un error server-side poco claro en vez de fallar visiblemente | Agregado `required` |
| 10 | `packages/core/src/cron/cron-service.ts` | `listRecentJobRuns()` devolvía `created_on`/`started_on`/`completed_on` como **string**, no `Date` — invisible mientras `pgboss.job` estaba vacía, se manifestó recién al arrancar `apps/worker` y generar filas reales | Parseo explícito con `new Date(...)` en vez de confiar en el tipo declarado de `db.execute<T>()` |
| 11 | ~30 componentes en todo `apps/web` (Setup, Asistencia, Activos, Herramientas, Portal, Gestión, Administración, componentes ITIL compartidos) | Patrón sistémico: casi todos los `<label>` eran hermanos sueltos de su `<input>`/`<select>` sin `htmlFor`/`id` — inservible para lectores de pantalla y para tests | Barrido completo agregando `id`/`htmlFor` (o `aria-label` en selects sin label visual) |
| 12 | `components/itil/{status-select,actor-form,cost-form,sla-form,validation-form,timeline-form}.tsx` | Varios campos sin **ningún** nombre accesible (ni label ni aria-label) | `aria-label` agregado a cada uno |

## 4. Auditoría de índices de base de datos

Auditado contra `pg_catalog` real (no adivinado): **108 columnas de foreign key sin índice**. El hallazgo más importante — `user_profiles.user_id`, la columna que `getEffectiveRights()` filtra en **cada** chequeo de permisos de toda la aplicación, sin índice.

Se agregaron **36 índices** en una sola migración puramente aditiva (`0016_skinny_liz_osborn.sql`, solo `CREATE INDEX`):
- `user_profiles.user_id` y `.profile_id` (hot-path RBAC)
- `groups.entity_id`/`.parent_id`, `user_groups.group_id`
- `entity_id` en ~25 tablas (patrón multi-tenant repetido en casi todo listado/reporte de la app)
- FKs de alto tráfico: `consumables.consumable_item_id`, `rule_criteria/rule_actions.rule_id`, `project_tasks/project_costs.project_id`, `kb_article_comments.article_id`, `queued_notifications.recipient_user_id`, `rss_feed_cached_items.feed_id`, `software_licenses.software_id`, `certificates.assigned_asset_id`, `impact_relations.impacted_asset_id`, `inventory_submissions.agent_id`, `reminders.owner_user_id`

Quedan ~66 columnas de menor prioridad sin indexar (mayormente dropdowns de solo-lectura tipo `manufacturer_dropdown_item_id`/`status_dropdown_item_id` y jerarquías self-referenciadas) — deliberadamente no agregadas para no generar sobre-indexado sin evidencia de patrón de consulta real.

## 5. Auditoría de valores hardcodeados

**Resultado principal: código limpio.** Sin secretos, URLs/puertos, ni UUIDs hardcodeados en código de producción.

Hallazgos menores corregidos:
- `SALT_ROUNDS = 12` duplicado en `user-service.ts` y `api-client-service.ts` → unificado en `packages/core/src/constants.ts`.
- Los 6 cron schedules de `apps/worker` (antes fijos en código) → ahora configurables vía variables de entorno (`SLA_ESCALATION_CRON`, `RECURRING_TICKETS_CRON`, `NOTIFICATION_DISPATCH_CRON`, `SAVED_SEARCH_ALERTS_CRON`, `WEBHOOK_DISPATCH_CRON`, `RSS_FEED_REFRESH_CRON`), documentadas en `.env.example`.

Hallazgos menores documentados, no corregidos (bajo impacto, requieren un cambio de diseño mayor):
- `CONTRACTS_EXPIRING_WITHIN_DAYS`/`STATS_REPORT_WINDOW_DAYS` (30 días fijo) en `card-provider.ts` — ventana no configurable por card individual.
- `RECENT_SUBMISSIONS_LIMIT = 5` en `inventory-agents/page.tsx` sin nombre de constante.
- `RETRY_BACKOFF_MINUTES = 5` en `webhook-service.ts` — ya bien nombrado, pero no configurable vía env.

## 6. Auditoría de librerías desactualizadas

`pnpm outdated -r`:

| Paquete | Actual | Última | Nota |
|---|---|---|---|
| `ldapjs` | 3.0.7 | — | **Deprecado** por el mantenedor |
| `zod` | 3.25.76 | 4.4.3 | Major con breaking changes — no actualizado en este pase (afecta todos los `.zod.ts` del proyecto) |
| `typescript` | 5.9.3 | 7.0.2 | Salto de 2 majors — no actualizado, riesgo de romper compilación en todo el monorepo |
| `vitest` | 3.2.7 | 4.1.10 | No actualizado — la suite recién escrita se validó contra la v3 |
| `eslint` | 9.39.5 | 10.7.0 | No actualizado |
| `react` / `react-dom` | 19.2.4 | 19.2.7 | Solo patch, bajo riesgo, no aplicado en este pase |
| `bcryptjs` | 2.4.3 | 3.0.3 | No actualizado |
| `@types/node` | 20.19.43 | 26.1.1 | Muy atrasado, pero son solo tipos de desarrollo |
| `@types/bcryptjs` | 2.4.6 | 3.0.0 | No actualizado |

**Ninguna actualización de versión se aplicó** en este pase — son cambios de alcance propio (varios son majors con breaking changes reales) que ameritan su propia sesión de trabajo dedicada, no mezclados con el pase de testing. `ldapjs` es el único que amerita reemplazo a mediano plazo por estar deprecado (no hay bug de seguridad conocido reportado, solo falta de mantenimiento activo).

## 7. Segunda ronda: hallazgos críticos corregidos (login LDAP, SLA, último acceso, aviso de renovación)

Tras el pase inicial de este reporte, una segunda pasada de auditoría (código muerto + campos de DB sin uso) encontró y corrigió 5 problemas reales adicionales, cada uno con test de regresión nuevo (o, en el caso del #17, con la propia suite E2E como regresión):

| # | Archivo | Bug | Fix |
|---|---|---|---|
| 13 | `apps/web/lib/auth.ts` | `packages/core/src/auth/ldap-service.ts` estaba completamente implementado (bind-as-service-account → búsqueda → re-bind-as-user, escape RFC-4515 de filtros) pero **nunca conectado** al `authorize()` de Auth.js — LDAP era 100% código muerto, ningún usuario podía loguearse vía LDAP sin importar la configuración | `authorize()` ahora intenta password local primero; si no hay cuenta local o la contraseña no matchea (y la cuenta no está desactivada), cae a `tryLdapLogin()` → `syncLdapUser()` (find-or-create por email) → `assignEntityAndProfileFromLdap()` solo en el primer sync (evita filas duplicadas en `assignUserProfile`, que no tiene constraint único en `(userId, entityId, profileId)`) |
| 14 | `packages/core/src/sla/sla-service.ts` | `runSlaEscalationSweep()` marcaba como incumplido (`isBreached=true`) cualquier asignación de SLA con `dueAt < now`, **sin revisar si el ticket/problema/cambio padre ya estaba resuelto** — cualquier ticket resuelto a tiempo terminaba marcado como incumplido retroactivamente en cuanto pasaba suficiente tiempo real | Se agrega `TERMINAL_STATUSES = new Set(["solved","closed"])`; el sweep ahora hace `getAssignmentParent()` (trae `entityId` + `status`) y salta la fila si el padre ya está en un estado terminal |
| 15 | `packages/core/src/users/user-service.ts` + `apps/web/lib/auth.ts` | `users.last_login_at` existía en el schema desde el inicio pero **nunca se escribía** — imposible saber si un usuario alguna vez inició sesión | Nueva función `stampLastLogin(userId)`, llamada una vez por login exitoso (local o LDAP) desde el callback `jwt` de Auth.js; columna "Último acceso" agregada a `/administration/users` |
| 16 | `apps/web/app/(central)/management/contracts/{contract-form.tsx}` + `apps/web/app/(central)/tools/reports/contracts-expiring/page.tsx` | `contracts.renewal_notice_days` existía en el schema y el form de creación de contrato nunca lo exponía; el reporte que debería usarlo aplicaba en cambio un umbral `days` genérico idéntico para todos los contratos, ignorando el valor por-contrato | Campo agregado al form; `getContractsExpiringReport()` ahora evalúa la ventana propia de cada contrato (`renewalNoticeDays ?? withinDays` como fallback) en vez de un único límite SQL compartido |
| 17 | `administration/users`, `setup/api-clients`, `administration/profiles`, `assets/dcim/racks/[assetId]` (las 4 páginas del layout "tabla + form" en `grid grid-cols-2`) | Ninguno de los 4 `<div>` que envuelven la tabla tenía `min-w-0`/`overflow-x-auto`; con suficiente contenido ancho no cortable (emails/usuarios largos, la nueva columna "Último acceso") la tabla crecía más allá de su columna del grid y **se superponía visualmente al form vecino**, interceptando los clicks del botón de submit — encontrado por Playwright al fallar `Users - create flow` con "element intercepts pointer events" tras agregar la columna de `lastLoginAt` | `min-w-0` en el contenedor de la tabla + `overflow-x-auto` envolviendo el `<table>` en las 4 páginas, para que el desborde haga scroll dentro de su propia celda en vez de invadir la columna vecina |

## 8. Auditoría de campos de base de datos sin uso

Auditoría columna-por-columna (`packages/db/src/schema/*.ts`) contra lecturas reales en `apps/web`/`packages/core`/`apps/worker`. Los 4 hallazgos de mayor impacto (arriba) ya se corrigieron; el resto queda documentado como gap de alcance (construir la UI que los consuma es trabajo de producto, no un bug):

- **Campos de Auth.js reservados, nunca leídos**: `users.language`, `users.timezone` (sin lógica de i18n/zona horaria en la app), `users.emailVerified`, `users.image` (campos del adapter para OAuth/avatar, sin UI que los use).
- **Escritos pero nunca mostrados** (`write-only`): `computers.lastBootAt`, `savedSearches.lastExecutionAt`/`.executionCount` (no hay motor de ejecución server-side de búsquedas guardadas, solo redirect), `inventoryLockedFields.lockedAt`, `dashboardCards.positionX`/`.positionY` (persistidos pero la página de dashboard aún no los traduce a grid), `itil_shared.solvedAt`/`.closedAt` (se estampan en la transición de estado pero no se muestran en ningún detalle ni reporte), `assets.comment`, `assetComponents.serialNumber`, `softwareLicenses.serialNumber`, `queuedNotifications.errorMessage`/`.sentAt` (sí hay página para la cola de webhooks, no para la de notificaciones), `inventorySubmissions.processedAt`, `contracts.comment`, `budgets.comment`, `suppliers.comment`, `contacts.comment`.
- **Aceptados por el servicio pero sin campo de formulario**: `consumables.purchaseDate`, `softwareLicenses.purchaseDate`/`.expirationDate` (a diferencia de `contracts`, no hay reporte de "licencias por vencer"), `itilCosts.budgetId`/`projectCosts.budgetId` (sin FK real ni selector de presupuesto), `projects.projectStateDropdownItemId`/`.projectTypeDropdownItemId`, `projectTasks.plannedDurationMinutes`/`.effectiveDurationMinutes`.
- **Tablas enteras sin superficie de UI**: `resourceVisibilityRules` (el filtro de lectura `isResourceVisibleTo()` sí está wireado en KB/Reminders/Dashboards/RSS, pero no existe ningún botón "Compartir" en la app), `projectTaskLinks` (dependencias entre tareas), `clusterMembers` y `enclosureSlots` (DCIM: la página de `/assets/dcim` anuncia "racks, chasis, PDUs, clusters y cables" pero solo Racks y Cables tienen UI real).

## 9. Auditoría de código muerto

- **Server Actions huérfanas (17)**: exportadas desde `apps/web/actions/*.actions.ts` pero jamás importadas por ninguna página/componente — todas siguen el mismo patrón "crear+listar sí, editar/borrar no": `updateAssetAction`, `assignAssetAction`, `softDeleteAssetAction`, `restoreAssetAction`, `purgeAssetAction` (assets.actions.ts); `updateChangeAction`, `updateProblemAction`, `updateTicketAction` (paridad con el hallazgo ya documentado en §10); `softDeleteContactAction`, `softDeleteSupplierAction`; `addClusterMemberAction`, `moveEntityAction` (el árbol de entidades es de solo lectura); `updateKbArticleAction`, `createKbCategoryAction`; `addProjectTaskLinkAction`, `updateProjectAction`; `createSavedSearchAlertAction`. Wirearlas es de bajo costo (cada una ya es un passthrough delgado a un servicio con tests propios) pero implica construir ~10 formularios de edición/borrado nuevos — fuera de alcance de este pase.
- **Feature completa sin UI: Categorías de KB.** `createKbCategory`/`listKbCategories`/`addKbArticleCategory` están implementadas y probadas en `kb-service.ts`, pero ningún artículo puede asignarse a una categoría desde la interfaz — el form de artículos no tiene selector de categoría.
- **Feature completa sin UI: "Compartir" recurso.** `shareDashboard()`/`shareReminder()` son wrappers documentados sobre `addVisibilityRule()`, listos para usarse, pero no existe ningún botón "Compartir" en dashboards, recordatorios, KB ni RSS feeds — el gap de §8 sobre `resourceVisibilityRules` es la misma causa raíz vista desde el ángulo de código.
- **Exports internos verificados como uso legítimo (no son bugs)**: `listRules` (solo llamado por `evaluateRules` en el mismo archivo) y `listPendingWebhooks` (solo llamado por `dispatchPendingWebhooks`) — se re-confirmaron como plumbing interno correctamente encapsulado, no como código muerto real.
- **~50 funciones exportadas de `packages/core` sin ningún caller** (ni en `apps/web`, ni en `apps/worker`, ni internamente) — mayormente el mismo patrón "sin UI de editar/borrar/detalle" repetido por recurso: `updateGroup`, `updateDropdownItem`, `deleteDocument`, `getSupplier`, `getContact`, `getBudget`, `updateAssetDefinition`, `removeAssetComponent`, `getDashboardByKey`, `updateDashboardCardPosition`, `createRecurringReservations`, `listProjectTaskLinks`, `removeProjectTeamMember`, entre otras. Patrón consistente con el recorte de alcance ya documentado en §10 (crear+listar, sin editar/borrar) — no se generó código nuevo para cerrarlas.
- **Tipos y schemas Zod sin uso** (`packages/core/src/validation/*.zod.ts`): 65 de 80 alias `type X = z.infer<typeof ...>` exportados nunca se importan fuera de su propio archivo (la mayoría de los servicios usan un tipo de objeto inline en la firma de su función en vez del alias compartido), y 18 de 97 schema consts exportados nunca se usan fuera de su archivo (sub-schemas de enum consumidos solo al armar el schema compuesto del mismo archivo, ej. `contractTypeSchema`, `licenseTypeSchema`, `ruleMatchTypeSchema`). No representan un riesgo funcional — son ruido de superficie de API pública que se podría reducir marcando estos exports como internos, pero tocar 80+ exports para ese único fin quedó fuera de alcance de este pase.

## 10. Hallazgos de producto documentados, no corregidos

Gaps reales pero deliberadamente no inventados (fuera del alcance de "encontrar y corregir bugs"):

- Sin UI de editar/borrar en la mayoría de los módulos (Suppliers, Contracts, Tickets/Problems/Changes, Assets, Dropdowns, SLA Policies, Rules, etc.) — solo creación, y en ITIL solo transición de estado.
- `updateTicketAction`/`updateProblemAction`/`updateChangeAction` existen en `packages/core` pero ninguna UI los invoca — código muerto desde la perspectiva del usuario.
- `retireConsumable()` no valida el estado actual antes de retirar (asimetría con `useConsumable()`, que sí valida).
- No hay FK real entre `contracts` y `budgets` (solo coinciden por `entityId` compartido).
- `certificate.zod.ts` no valida que `validFrom <= validUntil`.
- `dcim-service.ts`: `listCables()` no está scoped por entidad, a diferencia de casi todos los demás `list*`.
- `software-license-form.tsx` no expone `purchaseDate`/`expirationDate` pese a que el schema los soporta.
- `rss-feed.zod.ts` no aplica la validación anti-SSRF a nivel de schema (el guard real corre después, dentro de `refreshRssFeed()`).

## 12. Cuarta ronda: confirmación completa contra localhost (2026-07-21)

Ronda de **validación**, no de descubrimiento — el objetivo fue confirmar en vivo que todo lo documentado en las rondas 1-3 (índices, hardcodeo, tests) sigue sostenido hoy, correr la suite completa por CLI contra `localhost:3210`, y cerrar cualquier bug real que apareciera. Entremedio de la Tercera ronda (§7, 690 unit + 152 E2E) y esta, un trabajo previo no documentado en este archivo agregó **Jest** (`tests/jest/`, suite separada de Vitest — ver comentario en `tests/jest/jest.config.js`) cerrando los 2 gaps unitarios de alto riesgo que `docs/superpowers/specs/2026-07-19-plan-de-pruebas.md` había identificado (`auth/get-auth-context.ts`, `rules/rule-engine.ts`) + tests de 5 `apps/web/actions/*.ts`, y amplió la suite E2E con bloques `QA:`/`QA -` de validación de formularios (datos propios generados, no hardcodeados, más casos de campo vacío/formato inválido/fuera de rango) en `setup.spec.ts` y `tools.spec.ts`.

**Estado confirmado hoy, corrida real:**

| Suite | Comando | Resultado |
|---|---|---|
| Jest | `pnpm test:jest` | **71/71** (7 suites) |
| Vitest | `pnpm exec vitest run` (`packages/core`) | **693/693** (81 archivos) |
| Playwright E2E | `pnpm exec playwright test --project=chromium` contra `localhost:3210` | **236/236** (solo Chromium, único proyecto configurado) |

- **1 falla transitoria triangulada, no un bug real**: `webhook-service.test.ts > dispatchPendingWebhooks POSTs...` dio timeout (20s) en la corrida con Jest+E2E+dev server compitiendo por recursos en simultáneo en esta máquina (además de ~10 contenedores Postgres de otros proyectos ya corriendo). Aislado, el mismo test pasa en 2.9s. Re-corrida de la suite completa de `packages/core` en solitario: 693/693 verde. No se tocó código — no había nada que corregir.
- **Cobertura de validación de formularios (vacío/inválido/tipo incorrecto) ya está cerrada en los 8 módulos**, incluido Portal (`portal.spec.ts:81-117`, bloquea el submit con título vacío vía `validity.valid`) — no hizo falta agregar tests nuevos.
- **Auditoría de índices re-confirmada, cero gaps**: cruce en vivo contra `pg_catalog` de las 140 columnas FK y las 29 columnas `entity_id` del schema — el diff contra los índices reales (incluyendo los que cubren como columna líder de una PK compuesta, ej. `user_groups_user_id_group_id_pk`) da **vacío** en ambos casos. Los 36 índices de la migración `0016_skinny_liz_osborn.sql` (§4) siguen siendo la base y ningún schema nuevo desde entonces quedó sin indexar. Pooling de conexiones (`pg.Pool` en `packages/db/src/client.ts`) confirmado en uso, no una conexión sin pool.
- **Auditoría de hardcodeo re-confirmada**: cero secretos/contraseñas hardcodeadas fuera de fixtures de `*.test.ts` (valores de prueba tipo `"supersecret"`, nunca credenciales reales), cero URLs hardcodeadas fuera de placeholders de UI (`placeholder="https://ejemplo.com/..."`) y un link a la doc de Next.js. El único hardcodeo real que queda es el ya documentado en el plan de pruebas: **72/74 páginas con texto en español fijo en JSX, sin `next-intl`** — deliberadamente fuera de alcance de esta ronda (Fase 2 de i18n, migración propia de ~72 archivos, no un "arreglo" que quepa en un pase de QA).

**Conclusión:** la app está en verde de punta a punta hoy contra `localhost` — 1000 tests (71+693+236) pasando, cero errores de consola/red en toda la corrida E2E, base de datos indexada sin gaps, sin hardcodeo real pendiente salvo la migración de i18n ya conocida y explícitamente diferida.

## 13. Quinta ronda: auditoría exhaustiva de campos de DB sin uso + código muerto, vía 6 agentes en paralelo (2026-07-21)

Repregunta explícita del usuario: "¿hay campos de BD que no se estén usando? ¿hay código muerto?". En vez de repetir el barrido manual de §8/§9 (ya parcialmente stale), se lanzaron **6 agentes en paralelo**, cada uno auditando ~8 de los 47 archivos de schema (`packages/db/src/schema/*.ts`) columna por columna contra uso real en `apps/web` + `packages/core` + `apps/worker` (excluyendo tests y migraciones). Además se corrió **`knip`** (instalado temporalmente, desinstalado al terminar) para un barrido automático de exports/dependencias sin uso en todo el monorepo.

### 13.1 Correcciones a hallazgos ya documentados (staleness real, confirmada con código actual)

| Hallazgo viejo (§8/§9) | Estado hoy |
|---|---|
| `users.language`/`.timezone` "reservados, nunca leídos" | **`language` es STALE — ahora SÍ se usa** (Fase 1 de i18n: `account/page.tsx` → `LanguageForm` → `updateMyLanguageAction` → JWT → `i18n/request.ts` resuelve el locale real). `.timezone` sigue sin uso, confirmado. |
| `assets.comment` write-only | **STALE** — `asset-edit-form.tsx`/`generic-asset-edit-form.tsx` ahora lo leen y muestran en el form de edición. |
| `computers.lastBootAt` write-only | **STALE, más fuerte de lo esperado** — la columna **ya no existe** en el schema actual (fue removida). |
| `savedSearches.lastExecutionAt`/`.executionCount` write-only | **STALE** — esas columnas exactas no existen más; la feature se refactorizó a la tabla `saved_search_alerts` (`lastCheckedAt`, sí se lee para throttling). |
| `inventoryLockedFields.lockedAt` | **Dato incorrecto en el doc viejo** — esa columna no existe en `inventory.ts` actual (la tabla solo tiene `id`/`assetId`/`fieldName`). |
| §9 "Server Actions huérfanas": `updateAssetAction`, `updateTicketAction`, `updateProblemAction`, `updateChangeAction`, `softDeleteContactAction` | **Las 5 son STALE** — todas están wireadas hoy a UI real (`asset-edit-form.tsx`, `ticket-edit-form.tsx`, `problem-edit-form.tsx`, `change-edit-form.tsx`, y un botón "Eliminar" en `/management/suppliers`... revisar: confirmado también para contacts). Se construyó edición completa de Activos/Tickets/Problemas/Cambios desde el reporte viejo. |

### 13.2 Hallazgos nuevos, no documentados antes

- **`impactContexts` es una tabla 100% muerta** — declarada y documentada en su propio comentario ("config de exploración del mapa de impacto por activo raíz"), pero nunca insertada ni leída en ningún lugar de `packages/core`/`apps/web` fuera de un test. La feature descrita nunca se construyó.
- **Las 3 tablas de Auth.js (`accounts`, `sessions`, `verification_tokens`) están dormidas** — sus 17 columnas combinadas tienen cero referencias por nombre en todo el repo. Es consistente con la config real: `session: { strategy: "jwt" }` nunca invoca el adapter para sesiones, y no hay provider de email/passwordless ni SSO configurado activamente — las tablas solo se activarían si se configura `OIDC_ISSUER`/etc.
- **Bug funcional real #1 — checkbox de "Perfil por defecto" no hace nada**: `profile-form.tsx` tiene un checkbox que escribe `profiles.isDefault`, pero la lógica real de resolución de perfil por defecto (`get-auth-context.ts`) lee una columna distinta: `user_profiles.isDefault` (por asignación usuario↔perfil↔entidad, no por perfil). El checkbox a nivel de perfil es UI engañosa — parece funcional pero no afecta nada.
- **Bug funcional real #2 — conteo de asientos de licencias de software siempre da 0**: `countSeatsUsed()` cuenta instalaciones por `assetSoftwareInstallations.softwareLicenseId`, pero el único formulario que crea instalaciones (`install-software-form.tsx`) nunca envía ese campo — siempre queda `NULL`. El "X/Y asientos" mostrado en `/assets/software/[id]` está roto en la práctica, aunque el código de conteo en sí es correcto.
- **Patrón recurrente: filtros de soft-delete "muertos" en 5+ módulos** (`certificates`, `consumableItems`, `contracts`, `projects`, `groups.isActive`) — cada uno tiene un filtro `isNull(deletedAt)`/`eq(isActive, true)` real en su `list*()`, pero **ningún módulo tiene una función que realmente lo setee** (sin UI de eliminar/desactivar) — el filtro es una guarda protectora permanentemente inerte, no un bug, pero sí superficie sin terminar repetida.
- **`rss_feeds.refreshRateMinutes`** se captura, valida y muestra, pero el sweep real (`apps/worker/src/jobs/rss-feed-refresh.ts`) lo ignora y refresca todo cada 15 min fijo — ya documentado con comentario en el código como simplificación consciente, no un bug nuevo.
- **`kbArticleCategories`/`kbCategories`, `clusterMembers`, `enclosureSlots`** — confirmado: siguen 100% sin superficie de UI, igual que documentaba §8/§9.

### 13.3 Barrido `knip` (exports/dependencias sin uso, todo el monorepo)

Resultado mucho más acotado que el barrido manual viejo (evidencia de que gran parte de la deuda de §9 ya se cerró): **2 hallazgos reales, corregidos en el momento**:
- `statusLabel` en `status-badge.tsx` estaba exportado pero solo se usaba dentro del propio archivo → se le quitó el `export`.
- `@itsm/db` en `apps/worker/package.json` era una dependencia declarada sin ningún import directo (el worker accede a datos vía `@itsm/core`) → removida.
- Falso positivo descartado: `@auth/core` en `apps/web` parece sin uso para `knip` pero es necesario para el `declare module "@auth/core/jwt"` de `apps/web/lib/auth.ts` — no se tocó.
- `knip` se instaló solo para este análisis y se desinstaló al terminar (no queda como dependencia permanente del repo).

**No se tocó nada más** de §13.1/§13.2 más allá de las 2 correcciones de `knip` en el momento de escribir esto — los bugs funcionales #1 y #2 quedaron documentados, pendientes de decisión. Ambos se corrigieron en la siguiente pasada (§13.4).

### 13.4 Bugs funcionales #1 y #2 corregidos (2026-07-22)

**Bug #1 — checkbox "Perfil por defecto" muerto**: se decidió **quitar el checkbox** en vez de wirearlo a una nueva funcionalidad — `profiles.isDefault` no tenía ningún lector real y no era claro qué debería significar "perfil por defecto" a nivel de definición de perfil (a diferencia de `user_profiles.isDefault`, que sí es real: el flag por asignación usuario↔perfil↔entidad que `get-auth-context.ts` usa para resolver el contexto default al loguearse). Se quitó el checkbox de `profile-form.tsx` y se sacó `isDefault` de `createProfileAction`/`createProfileSchema`/`createProfile()` (la columna en sí no se tocó — sigue con default `false` a nivel de DB). `assignUserProfile()`/`assign-form.tsx` (el mecanismo real) no se tocaron.

**Bug #2 — conteo de asientos de licencias siempre en 0**: se agregó un selector "Licencia (opcional)" a `InstallSoftwareForm` (`apps/web/app/(central)/assets/computers/[id]/install-software-form.tsx`), poblado con `listSoftwareLicenses()` por cada software en scope (mismo patrón ya usado para `versionOptions`), que ahora sí envía `softwareLicenseId` a `createInstallationAction`. El schema/servicio (`createInstallationSchema`, `createInstallation()`) ya soportaban el campo end-to-end — solo faltaba la UI.

**Validación (Vitest + Playwright real, no solo lectura de código)**:
- `pnpm exec vitest run src/rbac/profile-service.test.ts src/software/software-service.test.ts` → 21/21 verde.
- Spec temporal de Playwright (creada y borrada en la misma sesión) confirmó en vivo: (a) el checkbox "Perfil por defecto" ya no existe en el form de creación, crear un perfil sigue funcionando; (b) crear software → versión → licencia (5 asientos) → computadora → instalar con licencia elegida → el detalle de software pasa de "0/5 asientos" a **"1/5 asientos"** — el bug real ya no reproduce.
- Re-corrida completa de `administration.spec.ts` + `assets.spec.ts` (64 tests, incluida la cobertura preexistente de creación de perfiles/permisos y de instalación de software) → **64/64 verde**, sin regresiones.
- `tsc --noEmit` en `apps/web` y `packages/core` limpio tras ambos cambios.

## 14. Documentación relacionada

- [`architecture-plan.md`](architecture-plan.md) — plan de arquitectura completo + narrativa de todas las fases, incluida la sección "Pase de testing y hardening" con este mismo resumen integrado al historial del proyecto.
- [`app-guide.md`](app-guide.md) — guía funcional de la app por módulo.
- [`comparison-vs-glpi.md`](comparison-vs-glpi.md) — comparación con GLPI original.
