# Guía funcional de la aplicación

Referencia de qué hace cada pantalla de la plataforma, organizada como aparece en el sidebar. Para el *por qué* de cada decisión técnica y el historial de construcción por fases, ver [`architecture-plan.md`](architecture-plan.md). Para cómo se compara con GLPI, ver [`comparison-vs-glpi.md`](comparison-vs-glpi.md).

Login de prueba: `admin@itsm.local` / `ChangeMe123!` (cambiar antes de un despliegue real vía `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`).

## Conceptos transversales

- **Entidades**: árbol multi-tenant (`/administration/entities`). Todo objeto (activo, ticket, contrato, etc.) pertenece a una entidad. Los permisos pueden ser específicos de una entidad o recursivos a sus descendientes (vía `ltree`).
- **Perfiles (RBAC)**: sets de permisos por módulo (`/administration/profiles`), asignables a un usuario en una o más entidades. Cada permiso es un bitmask (`READ`/`CREATE`/`UPDATE`/`DELETE`/`PURGE`/`APPROVE`/`ASSIGN`) sobre ~50 módulos con nombre punteado (`assets.computer`, `assistance.ticket`, etc.). La matriz completa (perfil × módulo × bit) se edita en `/administration/profiles/[id]`.
- **Interfaz Central vs. Simplified**: un perfil decide si el usuario ve el shell completo de administración (Central) o el portal de autoservicio (Simplified, `/portal`). El redirect de `/` decide según el perfil activo del usuario logueado.
- **Auditoría**: cada creación/edición relevante queda en `audit_log` (visible en `/administration/audit-log`, filtrable por tipo de objeto/usuario/fecha, con timestamp automático). Cobertura actual: tickets, cambios, problemas, base de conocimiento, SLA, computadoras, equipo de red. Todavía sin instrumentar: proyectos, contratos, presupuestos, certificados, consumibles, proveedores/contactos, usuarios/grupos/perfiles/entidades.
- **Idioma de interfaz**: selector de 6 idiomas (es/en/pt/fr/it/de) en `/account` y en el login. Cubre el sidebar de navegación completo, `/dashboard` y `/account` — el resto de la app (~72 pantallas) sigue en español fijo (Fase 2 pendiente, ver `architecture-plan.md`).
- **2FA por email (opt-in, por usuario)**: cada usuario activa/desactiva su propia verificación en dos pasos desde `/account` (`users.two_factor_enabled`, apagado por defecto — no es un ajuste global de la app). Con 2FA activo, tras verificar email+contraseña (local o LDAP) se envía un código de 4 dígitos por correo (vence en 10 min, máximo 5 intentos, un solo código activo por vez) antes de crear la sesión. `packages/core/src/auth/two-factor-service.ts` + `primary-factor.ts`. En dev/e2e (`E2E_TEST_MODE=true`, nunca en producción) el código se pre-rellena en el formulario para poder automatizar el flujo real sin leer un inbox.

## Asistencia (Helpdesk / ITIL)

- **Tickets** (`/assistance/tickets`): incidentes y solicitudes. Cada ticket tiene urgencia/impacto/prioridad (1-5), categoría, estado (`new → assigned/planned → pending → solved → closed`), actores (requester/assignee/observer), línea de tiempo (seguimientos/tareas), aprobaciones, costos, adjuntos, y campos custom definidos por admin (Form Builder, ver Configuración).
- **Problemas** (`/assistance/problems`) y **Cambios** (`/assistance/changes`): comparten el mismo motor de actores/timeline/aprobaciones/costos que Tickets (satélites polimórficos reusados, no tablas separadas por tipo). Change tiene además un flujo de aprobación tipo CAB (solicitar → aprobar/rechazar → ejecutar).
- **Tickets recurrentes** (`/assistance/recurring-tickets`): plantilla + intervalo en minutos; un job del worker genera el siguiente ticket cuando vence.
- **Catálogo de servicios** (`/setup/service-catalog`, visible también en el Portal): ítems predefinidos que preseleccionan tipo/categoría al crear un ticket.

## Activos

- **Activos genéricos** (`/assets`, `/assets/[tipo]`): cualquier tipo de activo sin tabla propia (Monitor, Impresora, Teléfono, Periférico, Dispositivo no gestionado, y cualquier tipo custom creado por un admin) vive en una tabla única `assets` con campos custom validados dinámicamente.
- **Computadoras** (`/assets/computers`) y **Equipo de red** (`/assets/network-equipment`): únicos 2 tipos con tabla de extensión propia (SO, dominio, IP/MAC) + componentes (CPU/RAM/disco/etc.) para Computadoras.
- **Software** (`/assets/software`): catálogo + versiones + licencias (per-seat/per-device/volumen/suscripción/OEM/freeware) + instalaciones por activo, con conteo de asientos usados.
- **DCIM** (`/assets/dcim`, `/assets/dcim/cables`): racks (posición U), enclosures, clusters, cableado entre activos — todo con FK real a `assets.id` (sin discriminador itemtype+id).
- **Análisis de impacto** (`/assets/impact/[assetId]`): grafo de dependencias entre activos (qué se ve afectado si este activo falla), navegable hacia adelante/atrás por profundidad.

## Gestión

- **Proveedores** (`/management/suppliers`) y **Contactos** (`/management/contacts`): contactos de proveedor, opcionalmente vinculados a un proveedor.
- **Contratos** (`/management/contracts`): tipo/frecuencia de facturación + activos vinculados (N:M) + aviso de renovación configurable por contrato (días de anticipación), usado por el reporte "Contratos por vencer".
- **Presupuestos** (`/management/budgets`): montos en centavos (sin floats), vinculables a costos ITIL.
- **Certificados** (`/management/certificates`): tipo SSL/firma de código/otro, asignable a un activo, con fecha de expiración.
- **Consumibles** (`/management/consumables`): catálogo (ej. "Tóner HP 26X") + unidades físicas individuales con estado (nueva/en uso/usada), asignables a un activo.
- **Datacenter/Dominio/Línea/Base de datos**: viven como tipos del framework de Activos (sin tabla propia), aparecen automáticamente en `/assets`.

## Herramientas

- **Base de conocimiento** (`/tools/knowledge-base`): artículos con categorías, comentarios, historial de revisiones (leído directamente del audit log, sin tabla propia), y visibilidad compartible.
- **Reservas** (`/tools/reservations`): reservar cualquier activo por rango de fechas, con detección de solape.
- **Proyectos** (`/tools/projects`): tareas (con jerarquía y enlaces), equipo, costos (vinculables a un presupuesto), % completado auto-calculado.
- **Reportes** (`/tools/reports`): agregaciones on-the-fly (sin tablas propias) — activos por tipo/estado, tickets por estado/día, cumplimiento de SLA, contratos por vencer, uso de reservas, activos por año.
- **Dashboards** (`/tools/dashboards`): tarjetas configurables respaldadas por las mismas funciones de Reportes, compartibles entre usuarios.
- **Búsquedas guardadas** (`/tools/saved-searches`) y **Feeds RSS** (`/tools/rss-feeds`): con alertas periódicas (sweep del worker) y validación anti-SSRF en las URLs de feed.
- **Recordatorios** (`/tools/reminders`): notas personales o compartidas.
- **Planificación** (`/tools/planning`): vista agregada de Cambios + Proyectos + Reservas en un rango de fechas.

## Administración

- **Entidades** (`/administration/entities`), **Usuarios** (`/administration/users`), **Grupos** (`/administration/groups`), **Perfiles** (`/administration/profiles`): gestión RBAC completa. La lista de usuarios muestra "Último acceso" (estampado en cada login exitoso, local o LDAP).
- **Log de auditoría** (`/administration/audit-log`): historial filtrable y paginado de cambios en toda la aplicación.

## Configuración (Setup)

- **Definiciones de activos** (`/setup/asset-definitions`): crear tipos de activo custom con campos dinámicos (texto/número/booleano/fecha/dropdown), sin migraciones.
- **Dropdowns** (`/setup/dropdowns`): categorías/ítems reusados por activos y campos custom tipo dropdown.
- **Políticas SLA** (`/setup/sla-policies`), **Plantillas de notificación** (`/setup/notification-templates`).
- **Motor de reglas** (`/setup/rules`): reglas genéricas (criterios AND/OR + acciones) reusadas por importación de inventario y asignación de entidad/perfil desde LDAP.
- **Agentes de inventario** (`/setup/inventory-agents`): envíos de un protocolo JSON propio, con bloqueo de campos por admin y promoción de dispositivos no reconocidos a activos genéricos.
- **Clientes API** (`/setup/api-clients`): tokens bearer estilo Stripe para la API REST pública (`/api/v1/...`).
- **Webhooks** (`/setup/webhooks`): eventos salientes firmados HMAC-SHA256 con cola de reintentos.
- **Fuentes de autenticación** (`/setup/auth-sources`): LDAP (bind-search-bind, en vivo desde el login de la app: si no hay cuenta local o la contraseña no matchea, cae a LDAP, sincroniza el usuario y asigna entidad/perfil en el primer login) + OIDC genérico (3 variables de entorno).
- **Campos de tickets** (`/setup/ticket-fields`): Form Builder — campos custom por tipo de ticket, mismo mecanismo de validación dinámica que Activos.
- **Panel de Cron** (`/setup/cron-jobs`): estado de los 6 jobs periódicos del worker (SLA, notificaciones, recurrencias, búsquedas guardadas, RSS, webhooks), solo lectura.

## Portal de autoservicio (`/portal`)

Shell separado (interfaz "Simplified") para usuarios finales: catálogo de servicios, formulario simplificado de creación de ticket (con campos custom del Form Builder si están definidos), y "Mis solicitudes".

## Asistente IA (`/assistant`)

Primer ítem del sidebar (visible solo si `AI_URL` está configurado en el entorno). Chat 100% nativo — no proxea a ninguna app externa; corre en el mismo proceso de `apps/web` (`/api/assistant/chat`, streaming SSE, y `/api/assistant/conversations[/[id]]`). El tool-calling contra Ollama resuelve las herramientas llamando directo a `ITEMTYPE_REGISTRY` (el mismo registro que expone `/api/mcp`) con el `AuthContext` real del usuario logueado — cada quien ve solo lo que sus permisos/entidad activa realmente permiten, sin token compartido de por medio. Historial de conversaciones persistido en la propia base de datos de GLPI-Plus (`assistant_conversations`/`assistant_messages`, packages/db) y cacheado en `localStorage` del navegador para resumir sin perder contexto tras un refresh. Conversación nueva muestra preguntas sugeridas basadas en las herramientas realmente disponibles.

Variables de entorno: `AI_URL` (servidor Ollama, remoto o local), `AI_API_KEY` (opcional, si el servidor lo requiere), `AI_MODEL` (modelo a usar). Sin `AI_URL` seteado, el link del sidebar y la tarjeta del dashboard quedan ocultos.

## Mi cuenta (`/account`)

Página personal de cualquier usuario logueado (no requiere permiso RBAC específico — es autogestión de la propia cuenta):

- **Datos**: nombre, email, entidad/perfil activos (solo lectura).
- **Idioma**: selector (`es`/`en`/`pt`/`fr`/`it`/`de`), guarda la preferencia en `users.language` y cambia efectivamente el idioma del sidebar + `/dashboard` + `/account` (Fase 1 del motor de i18n vía `next-intl`; el resto de la app aún no está traducido, ver nota en "Conceptos transversales").
- **Verificación en dos pasos**: toggle activar/desactivar el código de login por email (ver "Conceptos transversales"). Apagado por defecto.
- **Tokens MCP**: crear/listar/revocar tokens de acceso personal (prefijo `pat_`) para conectar clientes MCP (Claude Desktop, Claude Code, etc.) contra `/api/mcp`. La key cruda se muestra una sola vez al crearla — igual que en `/setup/api-clients`, no se puede volver a mostrar. Un token personal actúa con los mismos permisos RBAC del usuario dueño, no con una lista de scopes elegida a mano.

## API pública (`/api/v1/...`)

Bearer token de **entidad** (no sesión de navegador, no intercambiable con un token personal — un token personal usado acá devuelve 401). `GET /api/v1/[itemtype]` y `GET /api/v1/[itemtype]/[id]` para tickets/assets/computers/problems/changes, con scopes por cliente API (gestionados en `/setup/api-clients`). `GET /api/documents/[id]` para descargar adjuntos (requiere sesión).

## Servidor MCP (`/api/mcp`)

Endpoint MCP (Model Context Protocol) real, para que un cliente MCP (Claude Desktop, Claude Code, u otro) se conecte directamente a la instancia. Autenticado con un **token personal** (creado en `/account`, no un token de entidad — un token de entidad usado acá devuelve 401). Expone 10 tools de solo lectura, generadas automáticamente desde el mismo registro que respalda `/api/v1` (`list_tickets`, `get_tickets`, `list_assets`, `get_assets`, `list_computers`, `get_computers`, `list_problems`, `get_problems`, `list_changes`, `get_changes`) — cada llamada aplica el RBAC real del usuario dueño del token, nunca más permisos de los que ese usuario ya tiene logueado normalmente. Escritura (crear/editar vía MCP) queda deliberadamente fuera de alcance por ahora.

**Advertencia de seguridad conocida (lectura, sin cerrar)**: las tools `get_*` no verifican que el registro devuelto pertenezca a la entidad activa del que llama (mismo hueco preexistente en `/api/v1/[itemtype]/[id]`) — un id válido de otra entidad se devuelve igual si existe. La descripción de cada tool `get_*` incluye esta advertencia explícitamente para que un agente que la invoque lo tenga en cuenta. Detalle completo y plan de cierre en `architecture-plan.md`, sección "Tercera ronda".

**Hueco equivalente en escritura (cerrado)**: una auditoría de seguridad encontró el mismo patrón pero en las acciones de edición (`updateTicketAction`/`updateChangeAction`/`updateProblemAction`/`updateProjectAction`/`updateAssetAction` y las acciones de tareas/equipo/costos de Proyectos) — el chequeo de permisos validaba la entidad activa del usuario, no la entidad real del registro editado, permitiendo escritura cross-entity con el right adecuado en la entidad equivocada. Corregido: cada acción ahora resuelve el registro primero y valida el right contra `record.entityId` (`requireRightOnEntity`, `packages/core/src/auth/permissions.ts`). El download de documentos (`/api/documents/[id]`) tenía el mismo problema en forma más grave (cero chequeo de right, solo sesión válida) — también corregido.

## Testing

- **Unitarios/integración** (Vitest, `pnpm test`): 688 tests en `packages/core` + 4 en `apps/web` (i18n), contra Postgres real (sin mocks), un archivo por servicio + validación Zod.
- **End-to-end** (Playwright, `pnpm e2e` / `npx playwright test`): 235 tests en `e2e/specs/`, uno por sección del sidebar más una capa QA de datos propios/validación de tipos, con login real vía UI y datos generados en cada corrida. Reporte HTML: `pnpm e2e:report`.
- **Integración MCP real** (`apps/web/app/api/mcp/mcp-route.integration.test.ts`): usa el SDK cliente de MCP de verdad (no solo curl) contra un `npm run dev` corriendo. Separado del `pnpm test` por defecto — correr con `pnpm --filter @itsm/web test:mcp-integration`.

Ver [`qa-report.md`](qa-report.md) para el detalle completo de bugs encontrados/corregidos, auditoría de índices, valores hardcodeados, campos de base de datos sin uso y código muerto.
