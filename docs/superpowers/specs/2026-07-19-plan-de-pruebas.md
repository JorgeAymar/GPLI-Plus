# Plan de Pruebas — ITSM Platform

**Fecha:** 2026-07-19
**Método:** exploración en vivo con Playwright contra `localhost:3210` (45 rutas autenticadas + login), auditoría de dependencias (`pnpm outdated -r`, `pnpm audit`), y barrido de código en busca de valores hardcodeados. Todo lo que sigue está basado en evidencia real recolectada esta sesión, no en suposiciones — cada hallazgo indica cómo se verificó.

**Nota de alcance:** este documento es solo el plan. Por instrucción explícita, no se implementó ningún test ni fix a partir de este plan — eso es un paso posterior, separado.

---

## 1. Resumen ejecutivo

- **Salud general: muy buena.** 45/45 rutas autenticadas devuelven 200, cero errores de consola, cero errores de página, cero requests fallidos, cero patrones de anomalía (`undefined`, `[object Object]`, stack traces) en toda la app. El auth gate funciona correctamente (`/dashboard` sin sesión → 307 a `/login`).
- **La brecha más grande no es de bugs, es de alcance de i18n:** 72 de 74 páginas (97%) siguen 100% en español hardcodeado. Solo `/dashboard` y `/account` (más el nav sidebar) usan `next-intl`. Esto ya estaba documentado como Fase 2 pendiente — este plan lo cuantifica con el número real.
- **Cobertura de test actual:** 690 tests unitarios/integración (Vitest, `packages/core` contra Postgres real) + 152 tests E2E (Playwright, 8 specs, uno por sección del sidebar). Ambos suites en verde según el último `qa-report.md`.
- **Brecha real de cobertura unitaria encontrada:** `apps/web/actions/*` (43 archivos, la capa de Server Actions que conecta la UI con `packages/core`) tiene **cero** archivos de test dedicados. `packages/core/src` tiene 80/96 archivos con test directo (83%), con 2 gaps de alto riesgo: `auth/get-auth-context.ts` (resolución de sesión/RBAC) y `rules/rule-engine.ts` (motor de reglas de negocio).
- **Dependencias:** 2 vulnerabilidades moderadas (ambas transitivas, no en dependencias directas), 1 paquete deprecado (`ldapjs`), y ~12 paquetes con versiones menores/patch disponibles. Nada crítico ni urgente, pero hay una decisión pendiente sobre `ldapjs` (deprecado) que vale la pena programar.
- **No se encontraron secretos, URLs ni credenciales hardcodeadas** en el código de aplicación (`apps/web`, `packages/core`, `packages/db`, `apps/worker`) fuera de archivos de seed/ejemplo, que es donde corresponde que estén.

---

## 2. Inventario de la aplicación (verificado en vivo)

45 rutas autenticadas + `/login`, recorridas con sesión real de `admin@itsm.local`.

### 2.1 Estructura observada (aplica a casi todas las rutas de listado)

- **Las páginas de "lista" no usan `<table>`** salvo 7 excepciones (`/account`, `/assets`, `/administration/users`, `/administration/profiles`, `/administration/audit-log`, `/setup/api-clients`, `/setup/cron-jobs`). El resto renderiza filas como enlaces `<a>` dentro de un contenedor plano, no como `<tr>`. **Cualquier test que use un selector `table tbody tr` va a encontrar 0 filas en la mayoría de las páginas** — esto rompió el propio script de exploración de esta sesión (ver §5, hallazgo #2) y es el error más probable al escribir tests nuevos contra este código.
- **La mayoría de las páginas de lista son híbridos lista+creación en una sola URL.** No hay modal ni ruta `/new` separada — el botón "Crear X" es el submit de un formulario ya visible en la página. No navega, no abre `role=dialog`.
- **No se encontró ningún input de búsqueda/filtro en vivo** en `/assistance/tickets`, `/assets/computers`, ni `/administration/users`. Puede que la funcionalidad no exista todavía, o que use un patrón no estándar — **requiere confirmación manual antes de escribir tests de filtrado**, no asumir que existe.
- **`<title>` nunca cambia** — siempre `ITSM Platform`, incluso en páginas de detalle de un registro específico. No es un bug funcional pero afecta cualquier test que quiera diferenciar páginas por título.

### 2.2 Tabla de rutas por sección

| Sección | Ruta | Estado | Elementos clave observados |
|---|---|---|---|
| — | `/dashboard` | ✅ 200 | h1 "Dashboard" (i18n), 1 botón |
| — | `/account` | ✅ 200 | h1 "Mi cuenta" (i18n), `<table>`, selector de idioma (6 opciones), selector de entidad, form de tokens MCP |
| Asistencia | `/assistance/tickets` | ✅ 200 | "Crear ticket", 10 filas (datos E2E preexistentes) |
| Asistencia | `/assistance/problems` | ✅ 200 | "Crear problema", 5 filas |
| Asistencia | `/assistance/changes` | ✅ 200 | "Crear cambio", 5 filas |
| Asistencia | `/assistance/recurring-tickets` | ✅ 200 | "Crear recurrencia", lista vacía |
| Activos | `/assets` | ✅ 200 | `<table>` real, 20 chips de filtro por tipo |
| Activos | `/assets/computers` | ✅ 200 | "Crear computadora", 12 filas |
| Activos | `/assets/network-equipment` | ✅ 200 | "Crear equipo de red", lista vacía |
| Activos | `/assets/software` | ✅ 200 | "Crear software", 6 filas |
| Activos | `/assets/dcim` | ✅ 200 | enlaces a rack nuevo y a `/assets/dcim/cables` |
| Activos | `/assets/dcim/cables` | ✅ 200 | "Crear cable", lista vacía |
| Gestión | `/management/suppliers` | ✅ 200 | "Crear proveedor", 5 filas |
| Gestión | `/management/contacts` | ✅ 200 | "Crear contacto", lista vacía |
| Gestión | `/management/contracts` | ✅ 200 | "Crear contrato", 5 filas |
| Gestión | `/management/budgets` | ✅ 200 | "Crear presupuesto", lista vacía |
| Gestión | `/management/certificates` | ✅ 200 | "Crear certificado", lista vacía |
| Gestión | `/management/consumables` | ✅ 200 | "Crear consumible", 5 filas |
| Herramientas | `/tools/knowledge-base` | ✅ 200 | "Crear artículo", 5 artículos |
| Herramientas | `/tools/reservations` | ✅ 200 | "Habilitar para reserva", 5 filas |
| Herramientas | `/tools/projects` | ✅ 200 | "Crear proyecto", 4 filas |
| Herramientas | `/tools/reports` | ✅ 200 | 8 enlaces de reportes |
| Herramientas | `/tools/saved-searches` | ✅ 200 | "Crear búsqueda guardada", 10 enlaces "Usar" |
| Herramientas | `/tools/rss-feeds` | ✅ 200 | "Crear feed", 4 filas |
| Herramientas | `/tools/dashboards` | ✅ 200 | "Crear dashboard", 4 filas |
| Herramientas | `/tools/reminders` | ✅ 200 | "Crear recordatorio", lista vacía |
| Herramientas | `/tools/planning` | ✅ 200 | "Aplicar", lista vacía |
| Administración | `/administration/entities` | ✅ 200 | "Crear entidad", lista vacía |
| Administración | `/administration/users` | ✅ 200 | `<table>` real, "Crear usuario" |
| Administración | `/administration/groups` | ✅ 200 | "Crear grupo", 6 filas |
| Administración | `/administration/profiles` | ✅ 200 | `<table>` real, "Crear perfil", "Asignar", 7 enlaces "Permisos →" |
| Administración | `/administration/audit-log` | ✅ 200 | `<table>` real, "Filtrar", paginación "Siguiente" |
| Configuración | `/setup/asset-definitions` | ✅ 200 | "Crear tipo de activo", 20 enlaces |
| Configuración | `/setup/dropdowns` | ✅ 200 | "Crear categoría", 17 enlaces |
| Configuración | `/setup/sla-policies` | ✅ 200 | "Crear política SLA", lista vacía |
| Configuración | `/setup/notification-templates` | ✅ 200 | "Crear plantilla", lista vacía |
| Configuración | `/setup/rules` | ✅ 200 | "Crear regla", 6 filas |
| Configuración | `/setup/inventory-agents` | ✅ 200 | lista vacía |
| Configuración | `/setup/api-clients` | ✅ 200 | `<table>` real, **53 `<input>`** (outlier, revisar manualmente) |
| Configuración | `/setup/webhooks` | ✅ 200 | "Crear webhook", 5 filas |
| Configuración | `/setup/auth-sources` | ✅ 200 | "Crear fuente LDAP", form de 12 campos |
| Configuración | `/setup/service-catalog` | ✅ 200 | "Crear tipo de solicitud", lista vacía |
| Configuración | `/setup/ticket-fields` | ✅ 200 | "Crear campo", lista vacía |
| Configuración | `/setup/cron-jobs` | ✅ 200 | 2 `<table>` reales |
| Portal | `/portal` | ✅ 200 | h1 "¿En qué te podemos ayudar?", 5 enlaces a catálogo |
| — | `/login` (sin sesión) | ✅ 200 | form real, selector de idioma, gate de auth confirmado funcionando |

### 2.3 Páginas de detalle (muestreo de 4, todas sanas)

`/assistance/tickets/[id]`, `/assets/computers/[id]`, `/management/contracts/[id]`, `/tools/projects/[id]` — las 4 devuelven 200, cero errores, botones de acción específicos del dominio (Agregar actor, Instalar, Vincular, Crear tarea, etc.). Patrón de detalle consistente entre módulos.

---

## 3. Plan de pruebas funcionales (E2E)

### 3.1 Cobertura actual (baseline verificado)

| Spec file | Bloques test/describe | Sección cubierta |
|---|---|---|
| `account.spec.ts` | 5 | Mi cuenta, idioma, tokens MCP |
| `administration.spec.ts` | 30 | Entidades, usuarios, grupos, perfiles, audit log |
| `assets.spec.ts` | 25 | Todos los activos, computadoras, red, software, DCIM, cables |
| `assistance.spec.ts` | 22 | Tickets, problemas, cambios, recurrentes |
| `management.spec.ts` | 20 | Proveedores, contactos, contratos, presupuestos, certificados, consumibles |
| `portal.spec.ts` | 5 | Portal de autoservicio |
| `setup.spec.ts` | 40 | Los 12 módulos de Configuración |
| `tools.spec.ts` | 40 | Los 9 módulos de Herramientas |
| **Total** | **~187 bloques → 152 tests ejecutados** | Las 45 rutas tienen al menos un test |

Cada sección del sidebar ya tiene cobertura de happy-path. La densidad (152 tests / 45 rutas ≈ 3.4 por ruta) sugiere cobertura amplia pero no exhaustiva por ruta — consistente con lo que encontró la exploración: nada roto, pero varias preguntas abiertas (filtros, validación de formularios, límites) que probablemente no están cubiertas todavía.

### 3.2 Gaps funcionales a cerrar (priorizados)

**Alta prioridad — afecta a todos los módulos por igual:**

1. **Validación de formularios "Crear X" con datos inválidos/vacíos.** La exploración confirmó que el submit con campos vacíos es un no-op silencioso (no navega, no muestra error visible que el script haya detectado). Falta confirmar: ¿el usuario ve un mensaje de error claro, o el formulario simplemente no hace nada? Esto es un caso de UX y de test crítico en los ~35 módulos con form de creación inline.
2. **Comportamiint de búsqueda/filtro** en las páginas de lista — primero confirmar manualmente si existe la funcionalidad (la exploración no encontró inputs de búsqueda en 3 módulos probados), y si existe, testearla; si no existe, documentarlo como gap de producto, no de testing.
3. **Selector de idioma end-to-end en cada locale** — hoy `account.spec.ts` prueba el cambio a francés. Dado que Fase 2 de i18n eventualmente cubrirá más páginas, el plan de tests debe crecer junto con esa migración (no antes).

**Media prioridad — por módulo:**

4. **`/setup/api-clients`** — el outlier de 53 inputs amerita una revisión manual dedicada antes de escribir tests nuevos, para entender qué es cada campo (tokens por fila, copiar/revelar, etc.) y evitar tests frágiles.
5. **`/administration/audit-log`** — tiene paginación (`?page=2`) confirmada en vivo; verificar que existe un test que pruebe navegar a la página 2 y que el filtro (`Filtrar`) realmente filtra.
6. **`/administration/profiles`** → enlaces "Permisos →" (7 encontrados) — flujo de asignación de permisos por perfil, alto riesgo de seguridad si tiene bugs, candidato a tests dedicados si no los tiene ya.
7. **Páginas de detalle con acciones de dominio** (Agregar actor, Instalar, Vincular, Asignar SLA, Subir archivo) — confirmar que cada acción tiene al menos un test de happy-path; la exploración solo confirmó que los botones existen y la página carga, no que cada acción funciona.

**Baja prioridad:**

8. `<title>` genérico en toda la app — no es bug funcional, pero si en el futuro se agregan tests que dependen del título de la pestaña, van a fallar; documentarlo para que nadie lo intente.
9. Higiene de datos E2E acumulados (ver §6) — no bloquea tests pero ensucia el dataset de desarrollo.

### 3.3 Método recomendado para nuevos tests

Dado el hallazgo de §2.1 (no hay `<table>` en la mayoría de las listas), cualquier test nuevo debe:
- Localizar filas por rol/texto (`getByRole('link', { name: ... })`) en vez de `table tbody tr`, salvo en las 7 rutas que sí tienen `<table>` real.
- Usar coincidencia exacta de texto en botones "Crear X" (`{ name: 'Crear ticket', exact: true }`) — la exploración encontró un falso positivo real donde una etiqueta de estado "(Nuevo)" coincidió con una regex `/nuevo|crear/i` pensada para encontrar el botón de creación.

---

## 4. Plan de pruebas unitarias

### 4.1 Cobertura actual (baseline verificado)

- `packages/core/src`: 96 archivos de código, 80 con test directo (83%).
- `apps/web/actions`: 43 archivos, **0 con test directo**.
- 690 tests unitarios/integración corriendo en verde contra Postgres real (no mocks, según convención documentada del proyecto).

### 4.2 Gaps encontrados (verificados por comparación de archivos, no supuestos)

**Alto riesgo — sin test directo en `packages/core`:**

| Archivo | Por qué importa |
|---|---|
| `auth/get-auth-context.ts` | Resuelve sesión + contexto RBAC (entidad activa, perfil activo) — es la base de todo el control de acceso de la app. Un bug acá tiene el mayor radio de impacto posible. |
| `rules/rule-engine.ts` | Motor de ejecución de reglas de negocio (`/setup/rules`) — lógica condicional que puede tener muchos casos borde no cubiertos por un solo test de integración. |

**Riesgo medio — sin test directo:**

| Archivo | Nota |
|---|---|
| `storage/storage-adapter.ts` | Abstracción de almacenamiento de archivos (solo driver "local" implementado hoy — confirmado en código). |
| `notifications/transport.ts` | Mecanismo de entrega de notificaciones. |
| `api-clients/itemtype-registry.ts` | Registro central que alimenta tanto `/api/v1` como `/api/mcp` — probablemente cubierto indirectamente por los tests de esos endpoints, pero conviene confirmar. |

**Bajo riesgo (probablemente no necesitan test dedicado):**
- `constants.ts` — solo definiciones.
- `__vitest_tools__/fixtures.ts` — es infraestructura de testing, no código de producto.

**Gap estructural — capa completa sin cobertura unitaria:**

`apps/web/actions/*` (43 archivos: `tickets.actions.ts`, `users.actions.ts`, `rules.actions.ts`, etc.) son la capa que conecta Server Components/Client Components con `packages/core`. Hoy dependen 100% de los 152 tests E2E para su cobertura indirecta. Esto es una decisión de arquitectura válida (las actions son mayormente delegación fina hacia servicios ya testeados), pero cada action también contiene lógica propia — parseo/validación de input (`parseInput` helper), chequeos de ownership, llamadas a `revalidatePath`/`unstable_update` — que hoy solo se ejercita indirectamente vía UI. Vale la pena decidir explícitamente: ¿se acepta esta cobertura indirecta, o se agregan tests unitarios a las actions con lógica no trivial (auth checks, transformación de datos)?

### 4.3 Recomendación de priorización

1. `auth/get-auth-context.ts` — máxima prioridad, es el núcleo de seguridad.
2. `rules/rule-engine.ts` — alta prioridad, lógica de negocio compleja.
3. Actions con lógica de ownership/seguridad propia (ej. `api-clients.actions.ts`, `account.actions.ts` — ya tienen equivalente E2E, pero un test unitario aislaría bugs de lógica sin depender del navegador).
4. El resto, caso por caso, cuando se toque ese código.

---

## 5. Hallazgos durante la exploración (bugs/anomalías)

Lista corta — la app está limpia. Nada de esto bloquea nada, se documenta para que quede registrado:

1. **`<title>` genérico en toda la app** (siempre "ITSM Platform", incluso en páginas de detalle de un registro específico). Cosmético, no funcional.
2. **No existe `<table>` en la mayoría de las páginas de lista** — no es un bug, es cómo está construida la app, pero es la causa más probable de tests futuros rotos si alguien asume lo contrario (ver §3.3).
3. **Ningún input de búsqueda/filtro en vivo encontrado** en 3 módulos muestreados — requiere confirmación manual: ¿falta implementar, o el patrón de UI no es el esperado?
4. **`/setup/api-clients` tiene 53 `<input>`** — outlier estadístico frente al resto de la app (la mayoría de las páginas tiene 0-12), sin ser en sí un error. Revisar manualmente qué representa cada uno.
5. **No se encontró bypass de autenticación** — se investigó una falsa alarma inicial (el script de exploración heredó accidentalmente una sesión autenticada al crear un "contexto nuevo" de Playwright) y se confirmó que el gate de auth real funciona: sin cookies, `/dashboard` → 307 a `/login`, y `/api/auth/session` devuelve `null`.

No se encontraron: mensajes de error crudos mostrados al usuario, stack traces, `undefined`/`null`/`[object Object]` filtrándose a la UI, ni estados vacíos rotos.

---

## 6. Dependencias

### 6.1 Vulnerabilidades (`pnpm audit`)

| Severidad | Paquete | Vía | Nota |
|---|---|---|---|
| Moderada | `esbuild` (≤0.24.2) | `packages/db → drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils` | Solo afecta al dev server de esbuild (XSS/CSRF contra requests al servidor de desarrollo) — no es parte del bundle de producción. Vulnerabilidad transitiva profunda (4 niveles), no se resuelve con un bump directo; requiere `pnpm.overrides` o esperar que `drizzle-kit` actualice su dependencia. |
| Moderada | `postcss` (<8.5.10) | `apps/web → next → postcss` | Vía Next.js 16.2.10. Verificar si una versión patch más nueva de Next.js ya trae un `postcss` parchado antes de forzar un override manual. |

**Ninguna vulnerabilidad crítica o alta.** No hay urgencia de parchear, pero ambas están identificadas y con ruta clara.

### 6.2 Paquetes desactualizados (`pnpm outdated -r`)

| Paquete | Actual | Última | Nota |
|---|---|---|---|
| `ldapjs` | 3.0.7 | **Deprecado** | El paquete que da soporte a `/setup/auth-sources` (autenticación LDAP) está marcado deprecado upstream. No es una vulnerabilidad activa, pero es una decisión pendiente: buscar un reemplazo mantenido, o evaluar el riesgo de quedarse. Vale una investigación dedicada, no un simple bump. |
| `react` / `react-dom` | 19.2.4 | 19.2.7 | Patch menor. |
| `zod` | 3.25.76 | 4.4.3 | **Major** — usado en `packages/core` y `apps/web` para toda la validación de input. Un upgrade a Zod 4 no es un simple bump, tiene cambios de API; requiere su propio plan de migración, no incluirlo en un barrido general. |
| `typescript` | 5.9.3 | 7.0.2 | **Major×2** — mismo criterio que Zod, requiere evaluación dedicada, no bump automático. |
| `eslint` | 9.39.5 | 10.7.0 | Major, evaluar config de reglas antes de subir. |
| `vitest` | 3.2.7 | 4.1.10 | Major, dado que 690 tests dependen de este runner, cualquier upgrade necesita correr la suite completa como validación antes de mergear. |
| `@types/node` | 20.19.43 | 26.1.1 | Ligado a la versión de Node objetivo (repo pide Node ≥22) — subir esto de más podría introducir tipos de APIs no disponibles en el Node real del proyecto; alinear con la versión de Node real antes de subir. |
| `bcryptjs` | 2.4.3 | 3.0.3 | Major, usado para hashing de contraseñas — cualquier cambio acá amerita revisión de seguridad antes de actualizar, no un bump ciego. |
| `tailwindcss` / `@tailwindcss/postcss` | 4.3.2 | 4.3.3 | Patch, bajo riesgo. |
| `tsx` | 4.23.0 | 4.23.1 | Patch, bajo riesgo. |
| `turbo` | 2.10.4 | 2.10.5 | Patch, bajo riesgo. |
| `pg-boss` | 12.26.0 | 12.26.1 | Patch, bajo riesgo — usado por `apps/worker` para todos los jobs en background. |

**Recomendación:** los patches (`react`, `tailwindcss`, `tsx`, `turbo`, `pg-boss`, `@tailwindcss/postcss`) son de bajo riesgo y se pueden agrupar en un solo bump con la suite de tests como gate. Los majors (`zod`, `typescript`, `eslint`, `vitest`, `@types/node`, `bcryptjs`) necesitan cada uno su propia evaluación — no agruparlos, cada uno puede requerir cambios de código no triviales.

---

## 7. Valores hardcodeados

### 7.1 Confirmado: el único hardcodeo sistemático es i18n

72/74 páginas (`page.tsx`) — todo excepto `/dashboard` y `/account` — tienen 100% de su texto en español hardcodeado en JSX, en vez de usar `next-intl`. Esto coincide exactamente con el alcance documentado de la Fase 1 del motor de i18n (nav sidebar + dashboard + account) — Fase 2 (el resto) sigue pendiente, sin sorpresas.

### 7.2 Confirmado: no hay otros hardcodeos preocupantes

- **Sin secretos/credenciales hardcodeadas** en `apps/web`, `packages/core`, `packages/db`, `apps/worker` — barrido explícito con patrones de password/api-key/secret, cero resultados fuera de archivos de seed (donde corresponde).
- **Sin URLs/puertos hardcodeados** fuera de `.env` — el único hallazgo de `localhost`/`127.0.0.1` en código de producto es una lista de bloqueo SSRF intencional en `rss-feed-service.ts` (impide que un feed RSS apunte a la red interna), no una config hardcodeada por error.
- **Sin duplicación del registro de itemtypes** — tanto `/api/v1` como `/api/mcp` importan el mismo `ITEMTYPE_REGISTRY` centralizado, sin listas paralelas que puedan desincronizarse.

---

## 8. Higiene de datos de prueba

La exploración encontró un volumen considerable de datos `E2E-*` acumulados en la base de datos de desarrollo (prefijos `E2E-ASSISTANCE-*`, `E2E-ASSETS-*`, `E2E-MANAGEMENT-*`, `E2E-TOOLS-*`, `E2E-SETUP-*`, `E2E-ADMIN-*`), producto de corridas anteriores de la suite E2E y de QA manual. No bloquea nada, pero:
- Ensucia cualquier exploración manual futura (es difícil distinguir datos reales de datos de test a simple vista).
- Vale la pena un `docker compose down -v` + reseed limpio antes de la próxima ronda de QA manual, o un script de limpieza dedicado si se quiere conservar el resto del dataset de desarrollo.

---

## 9. Fases recomendadas (siguiente paso, fuera de este documento)

Este plan no se ejecuta acá — es la base para decidir el orden. Sugerencia de secuencia, a confirmar:

1. **Cerrar los 2 gaps unitarios de alto riesgo** (`get-auth-context.ts`, `rule-engine.ts`) — bajo esfuerzo, alto impacto en confianza sobre seguridad y lógica de negocio.
2. **Confirmar manualmente** los 2 puntos que la exploración dejó abiertos (¿existe búsqueda/filtro?, ¿qué son los 53 inputs de `/setup/api-clients`?) antes de escribir tests nuevos sobre ellos.
3. **Cerrar el gap funcional de validación de formularios vacíos** — across-the-board, mismo patrón en ~35 módulos, probablemente automatizable con un solo test parametrizado en vez de 35 tests manuales.
4. **Bump de dependencias patch** (bajo riesgo, agrupado) como mantenimiento de rutina.
5. **Evaluación dedicada de `ldapjs` deprecado** — investigación de alternativas, no un simple bump.
6. Los majors de dependencias (Zod 4, TypeScript 7, Vitest 4, ESLint 10, bcryptjs 3) y la Fase 2 de i18n quedan como iniciativas propias, ya documentadas como fuera de alcance de este plan.
