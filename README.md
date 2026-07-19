# ITSM Platform

Plataforma propia de ITSM / gestión de activos IT (helpdesk, inventario, RBAC multi-entidad), inspirada funcionalmente en GLPI pero **reimplementada de forma independiente** ("clean-room") en Next.js 16 + TypeScript + PostgreSQL, pensada para instalarse on-premise en la infraestructura de cada cliente vía Docker.

## Por qué existe este proyecto

GLPI es GPL-3.0. Traducir su código o esquema de base de datos directamente crearía una obra derivada bajo esa licencia, y como este producto se entrega instalado en la máquina del cliente (no como SaaS centralizado), eso cuenta como "distribución" a efectos de GPL-3.0. Por eso este repo **no contiene ni traduce código de GLPI**: es una reimplementación propia del mismo dominio funcional (ITSM + gestión de activos), con arquitectura, esquema de base de datos y código 100% propios. El directorio `source/` es un clon de GLPI usado únicamente como referencia de investigación de qué módulos/funcionalidades existen — nunca se commitea a git ni se incluye en imágenes Docker (ver `.gitignore` / `.dockerignore`).

El plan de arquitectura completo (decisiones técnicas, esquema de base de datos, roadmap por fases) está en [`docs/architecture-plan.md`](docs/architecture-plan.md).

## Stack técnico

- **Next.js 16** (App Router, Turbopack, Server Actions)
- **TypeScript**
- **PostgreSQL 16** vía **Drizzle ORM**
- **Auth.js v5** (sesión JWT — el proveedor Credentials no soporta sesiones en DB)
- **Tailwind CSS v4**
- **pnpm workspaces + Turborepo** (monorepo)

## Estructura del proyecto

```
apps/web        Next.js app: UI, Server Actions, Auth.js, proxy.ts (middleware)
apps/worker     Proceso pg-boss: escalamiento de SLA, despacho de notificaciones, tickets recurrentes
packages/db     Esquema Drizzle + migraciones (agnóstico de framework)
packages/core   Capa de servicios de negocio + validación Zod + RBAC (agnóstico de framework)
docs/           Documentación y plan de arquitectura completo
source/         Clon de referencia de GLPI (GPL-3.0) — solo investigación, nunca se distribuye
```

Dentro de `apps/web`:
```
app/(auth)/            Login (sin sidebar)
app/(central)/          Shell principal: sidebar, entity/profile switcher
  account/               Mi cuenta: tokens de acceso personales (MCP) + preferencia de idioma
  administration/       Entidades, Usuarios, Grupos, Perfiles (RBAC + matriz de permisos)
  assets/                Activos (genéricos + por tipo), DCIM (racks/cables), impacto
  assistance/            Tickets, Problemas, Cambios (ITIL), tickets recurrentes
  management/            Proveedores, Contactos, Contratos, Presupuestos, Certificados
  tools/                 Knowledge Base, Reservas, Proyectos, Reportes, Dashboards, Búsquedas guardadas, Feeds RSS
  setup/                 Tipos de activo, dropdowns, SLA, notificaciones, reglas, agentes de inventario, clientes API, webhooks, fuentes LDAP/OIDC
app/(simplified)/portal  Portal de autoservicio: crear ticket simplificado + "Mis solicitudes"
app/api/v1/[itemtype]    API REST pública (bearer token de entidad, no sesión JWT)
app/api/mcp              Servidor MCP (bearer token personal) — expone list_*/get_* como tools para Claude/clientes MCP
app/api/documents/[id]   Descarga de adjuntos
actions/                 Server Actions (una por dominio, "use server")
components/itil/        Componentes ITIL compartidos (actores/timeline/aprobaciones/costos/SLA) — reusados por Ticket/Problem/Change
components/documents/   AttachmentsSection reusable (adjuntos polimórficos, cualquier módulo)
lib/auth.ts, lib/session.ts   Auth.js (Credentials + OIDC opcional) + resolución de contexto (entidad/perfil activo)
```

## Quickstart (desarrollo local)

```bash
cp .env.example .env                      # ajustar si es necesario
docker compose up -d                      # Postgres en localhost:5436
pnpm install
pnpm db:migrate                           # aplica migraciones (incluye CREATE EXTENSION ltree)
pnpm --filter @itsm/core seed             # entidad raíz + perfil Super-Admin + usuario admin + política SLA (idempotente)
pnpm --filter @itsm/web dev               # http://localhost:3210
pnpm --filter @itsm/worker dev            # opcional: SLA (5min), notificaciones (1min), recurrentes (15min),
                                           # búsquedas guardadas (15min), RSS (15min), webhooks (1min)
```

Login de prueba: **admin@itsm.local** / **ChangeMe123!** (cambiar via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` antes de sembrar en un entorno real).

> Nota: el puerto de Postgres (5436) y el del dev server (3210) se eligieron para no chocar con otros proyectos en la misma máquina. Ajustar en `docker-compose.yml`/`.env`/`apps/web/package.json` si es necesario.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` / `build` / `lint` / `typecheck` / `test` | Corren en los 4 paquetes (`apps/web`, `apps/worker`, `packages/db`, `packages/core`) vía Turborepo |
| `pnpm db:generate` | Genera una migración Drizzle nueva a partir del schema en `packages/db/src/schema` |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm --filter @itsm/core seed` | Siembra datos base (idempotente, seguro de re-correr) |

## Estado del proyecto

| Fase | Contenido | Estado |
|---|---|---|
| 0 — Scaffold | Monorepo, Next.js, Docker | ✅ Completa (CI se agregó y luego se removió a pedido explícito — sin pipeline automático hoy) |
| 1 — Foundation | Entidades, Usuarios, RBAC, switch entidad/perfil | ✅ Completa |
| 2 — Asset Management | Tipos de activo (core + custom), Computer/Network Equipment, Software/Licencias | ✅ Completa (2a+2b+2c) |
| 3 — Helpdesk/ITIL | Ticket/Problem/Change, SLA, notificaciones, portal, recurrencias | ✅ Completa |
| 4 — Management | Proveedores/Contactos, Presupuestos/Contratos, Certificados, Datacenter/Dominio/Línea/BD | ✅ Completa (4a+4b+4c) |
| 5 — Tools | Knowledge Base, Reservas, Proyectos, Reportes, Dashboards, Búsquedas guardadas, Feeds RSS | ✅ Completa (5a-5f) |
| 6 — Advanced/Parity | Rule engine, Inventory, DCIM, Impact Analysis, API pública (bearer token), Webhooks, LDAP+OIDC — SAML diferido, sin sistema de plugins (decisiones documentadas) | ✅ Completa (6a-6g; 6h=doc) |
| Post-roadmap — Tokens personales + MCP | `/account` (tokens MCP personales + preferencia de idioma), servidor MCP real en `/api/mcp` (10 tools sobre `ITEMTYPE_REGISTRY`), fix de un bug real de producción (loop de redirect con sesión huérfana) | ✅ Completa (detalle en `architecture-plan.md`, "Tercera ronda") |

**Post-roadmap**: cerrados **los 13 gaps no bloqueantes** detectados tras completar el roadmap original:
- Redirect `/` según perfil Central/Simplified, matriz de permisos perfil×módulo (`/administration/profiles/[id]`), adjuntos polimórficos (`documents`/`document_items` + storage adapter local, en Tickets y Computers), Grupos (`/administration/groups`).
- Cartridge/Consumable (`/management/consumables`), Service Catalog (`/setup/service-catalog` + sección en el portal), Unmanaged Device (aceptar submissions de inventario sin match como activo genérico), Reminder (`/tools/reminders`, compartibles vía `resource_visibility_rules`), Form Builder de tickets (`/setup/ticket-fields`, campos custom validados dinámicamente igual que Assets), Planning (`/tools/planning`, agrega Cambios+Proyectos+Reservas), Log Viewer (`/administration/audit-log`), panel de Cron (`/setup/cron-jobs`, lee las tablas `pgboss.*` directamente), y Stats (2 reportes nuevos: tickets por día, cumplimiento de SLA).

Quedan solo por decisión explícita (no son bugs, no se revierten): SAML, sistema de plugins de terceros, OAuth2 completo (quedó bearer token) — riesgo de seguridad desproporcionado para el modelo de negocio.

**Testing**: 690 tests unitarios/integración (Vitest, `packages/core` contra Postgres real) + 152 tests E2E (Playwright/Chromium, `e2e/specs/`, uno por sección del sidebar con login real) — **100% verdes**. Este pase de testing encontró y corrigió bugs reales: coerción de booleanos en campos dinámicos (Assets y Form Builder de Tickets), una tarjeta de dashboard que nunca mostraba datos por mismatch de forma, todo el módulo de Configuración mostrando errores de validación como JSON crudo, Administración sin escribir al audit log, `cron-service.ts` devolviendo timestamps como string en vez de `Date`, y 36 índices de base de datos faltantes (incluyendo el lookup RBAC más caliente de la app, `user_profiles.user_id`, sin índice). Ver `pnpm test` / `pnpm e2e` / `pnpm e2e:report`. Hay además un test de integración MCP real (`apps/web/app/api/mcp/mcp-route.integration.test.ts`, corre aparte vía `pnpm --filter @itsm/web test:mcp-integration` porque requiere un `npm run dev` levantado — deliberadamente excluido del `pnpm test` por defecto para que ese comando siga siendo determinístico).

Detalle completo de cada fase (incluyendo decisiones tomadas sobre la marcha y correcciones a bugs reales de Auth.js/Next.js 16) en [`docs/architecture-plan.md`](docs/architecture-plan.md). Guía funcional completa en [`docs/app-guide.md`](docs/app-guide.md); comparación detallada con GLPI original en [`docs/comparison-vs-glpi.md`](docs/comparison-vs-glpi.md).

## Producción (instalación on-premise vía Docker)

`apps/web/Dockerfile` es un build multi-stage con salida `standalone` de Next.js: instala dependencias del workspace, compila, y en el arranque del contenedor corre las migraciones de Drizzle antes de levantar el servidor (`apps/web/docker-entrypoint.sh`).

```bash
docker build -f apps/web/Dockerfile -t itsm-web .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://user:pass@host:5432/db \
  -e AUTH_SECRET=... \
  -e AUTH_URL=https://cliente.example.com \
  itsm-web
```

No hay CI configurado en GitHub Actions (se agregó un workflow en un momento del proyecto y se removió a pedido explícito del usuario) — el repo no corre un pipeline automático en cada push. `pnpm lint`/`typecheck`/`test`/`build` deben correrse a mano antes de mergear.
