# Esta plataforma vs. GLPI original

Este documento compara la reimplementación (Next.js 16 + TypeScript + PostgreSQL) con [GLPI](https://www.glpi-project.org/en/) (PHP + MySQL/MariaDB, GPL-3.0), la referencia funcional usada solo como catálogo de features (ver [`docs/architecture-plan.md`](architecture-plan.md) para la justificación legal completa del enfoque *clean-room*). El objetivo no es decir que GLPI es "malo" — es un producto maduro con 20+ años de producción real — sino documentar en qué la reescritura sobre una base moderna resultó en ventajas concretas, medibles, y dónde GLPI todavía tiene más superficie cubierta (paridad no significa superset).

## Resumen ejecutivo

| Dimensión | GLPI | Esta plataforma |
|---|---|---|
| Lenguaje/runtime | PHP 8, arquitectura de autoload por convención | TypeScript de punta a punta (schema, backend, frontend), un solo lenguaje |
| Seguridad de tipos | Ninguna a nivel de esquema; SQL construido dinámicamente en muchos módulos | Esquema fuertemente tipado (Drizzle) + validación Zod en cada escritura, de servicio a base de datos |
| Modelo de datos de activos | ~15 tablas paralelas por tipo de activo, cada una con su propio `itemtype+items_id` | Una tabla `assets` unificada + tablas de extensión finas solo donde hace falta integridad relacional real |
| Multi-tenancy | Entidades con jerarquía por adyacencia simple | Entidades con `ltree` (jerarquía indexada nativamente por Postgres, queries de subárbol O(índice) en vez de recursión en aplicación) |
| Extensibilidad | Sistema de plugins con carga dinámica de código de terceros en el mismo proceso | Webhooks firmados (HMAC-SHA256) + API REST con bearer token — mismo caso de uso cubierto sin superficie de RCE |
| Autenticación empresarial | SAML/LDAP/OIDC hardcodeados por proveedor (Google/Azure) | OIDC genérico (cualquier IdP compatible) vía 3 variables de entorno; LDAP con escape de filtro explícito |
| Testing | Sin suite de tests automatizados conocida en el core | 672 tests unitarios/integración (Vitest) + 149 tests E2E (Playwright) sobre datos reales |
| Despliegue | Instalación PHP clásica (Apache/nginx + PHP-FPM + MySQL) | Imagen Docker `standalone` de Next.js, migra su propio schema al arrancar, pensada para instalación on-prem por cliente |

## Ventajas arquitectónicas concretas

### 1. Modelo de datos de activos unificado

GLPI modela cada tipo de activo (Computer, Monitor, NetworkEquipment, Printer, Phone, ...) como una tabla independiente, cada una con su propio `itemtype` string usado como discriminador en decenas de tablas satélite (`glpi_documents_items`, `glpi_infocoms`, etc. — cada una necesita `itemtype + items_id` en vez de un FK real). Esto funciona, pero cada relación cruzada (adjuntos, contratos, reservas, análisis de impacto) tiene que reimplementar el mismo patrón de discriminador manualmente, tabla por tabla.

Esta plataforma unifica todo activo físico en una sola tabla `assets` (con `asset_definitions`/`asset_field_definitions` para tipos y campos custom sin migraciones) y usa tablas de extensión finas con **FK real y `ON DELETE CASCADE` verificado** solo donde el tipo necesita integridad relacional adicional (`computers`, `network_equipment`, componentes). El resultado práctico:

- **Reservas, Contratos, Certificados, Impact Analysis, DCIM** referencian `assets.id` con un FK simple — no un par `(itemtype, items_id)` sin garantías de integridad a nivel de base de datos.
- Agregar un tipo de activo nuevo (Datacenter, Domain, Line, Database — ver Fase 4c en `architecture-plan.md`) es **una fila de configuración**, no una tabla ni código nuevo.

### 2. Seguridad de tipos de punta a punta

GLPI construye queries dinámicamente en PHP sin un compilador que verifique tipos entre el esquema y el código que lo consume. Esta plataforma tiene:

- **Drizzle ORM**: el esquema de PostgreSQL genera tipos TypeScript automáticamente; un cambio de columna que rompe un query en cualquier archivo del monorepo falla en `tsc --noEmit`, no en producción.
- **Validación Zod en cada frontera de escritura**: cada Server Action valida su input contra un schema explícito antes de tocar la base de datos — incluyendo campos dinámicos (custom fields de Assets y de Tickets) validados en runtime contra la definición que el admin configuró, con coerción de tipos correcta (el pase de testing de esta sesión encontró y corrigió un bug real de coerción de booleanos que afectaba tanto a Assets como a Tickets).
- **`noUncheckedIndexedAccess` activado** en todo el monorepo — acceder a un elemento de array/resultado de query sin verificar que existe es un error de compilación, no un `null` silencioso en producción.

### 3. Jerarquía de entidades con `ltree`

GLPI resuelve la jerarquía de entidades con adyacencia simple (`entities_id` recursivo) y arma queries de subárbol con `WHERE entities_id IN (SELECT ...)` recursivo en cada punto que lo necesita. Esta plataforma usa la extensión nativa `ltree` de PostgreSQL: cada entidad tiene un `path` tipo `root.child.grandchild` con un índice GIST, así que "todo lo que pertenece a esta entidad o sus descendientes" es una comparación de índice (`path <@ 'root.child'`), no una CTE recursiva evaluada en cada request. El mismo patrón de índice GIST + comparación de subárbol se reusa para RBAC recursivo (`user_profiles.isRecursive`), grupos y dropdowns.

### 4. Motor de reglas genérico reusado, no reimplementado por dominio

GLPI tiene motores de reglas separados por caso de uso (`RuleImportAsset`, `RuleRight`, `RuleTicket`, etc.), cada uno con su propia lógica de evaluación de criterios/acciones. Esta plataforma construyó **un solo motor genérico** (`rules`/`rule_criteria`/`rule_actions`, con `ruleType` como texto libre en vez de una tabla por dominio) reusado tanto por el matching de importación de inventario como por la asignación automática de entidad/perfil desde LDAP — la misma inversión de ingeniería sirve para casos de uso que en GLPI requieren subsistemas separados.

### 5. Extensibilidad sin ejecutar código de terceros

El sistema de plugins de GLPI carga código PHP arbitrario de terceros en el mismo proceso del servidor (autoload por convención de nombre de función). Es potente, pero cualquier plugin instalado tiene el mismo nivel de acceso que el core — sin sandboxing. Esta plataforma decidió explícitamente (documentado como decisión de seguridad, no como omisión) no replicar ese modelo, y en su lugar cubre el caso de uso real de extensibilidad con:

- **API REST pública** (bearer token estilo Stripe, `sk_...` + hash bcrypt, nunca se re-almacena la key cruda) para que sistemas externos lean/escriban datos.
- **Webhooks salientes firmados** (HMAC-SHA256, cola con reintentos y backoff, igual mecanismo que la cola de notificaciones) para que sistemas externos reaccionen a eventos.

Ninguno de los dos ejecuta código subido por un tercero dentro del proceso del servidor.

### 6. Autenticación empresarial más simple de configurar

GLPI hardcodea la integración con proveedores específicos (Google Workspace, Azure AD) en vez de soportar OIDC de forma genérica. Esta plataforma usa Auth.js con un proveedor OIDC genérico — **cualquier** identity provider compatible con el estándar (Okta, Auth0, Keycloak, Azure AD/Entra ID, Google Workspace, o uno propio) se conecta con 3 variables de entorno (`OIDC_ISSUER`/`OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET`), sin código nuevo por proveedor.

### 7. Cobertura de tests real (GLPI no la tiene documentada en su core público)

Esta plataforma cerró esta sesión con:
- **672 tests unitarios/de integración** (Vitest) sobre `packages/core` — cada servicio de negocio (RBAC, ITIL, Assets, Management, Tools, Plataforma) probado contra Postgres real, no mocks.
- **149 tests E2E** (Playwright, Chromium) que recorren cada menú/pantalla/formulario/botón de la aplicación real, con un usuario admin autenticado de verdad (no un stub de sesión).
- El propio proceso de escribir estos tests **encontró y corrigió bugs reales de producción** (ver `docs/architecture-plan.md`, sección de testing): un bug de coerción de booleanos en dos validadores de campos dinámicos, una tarjeta de dashboard que nunca mostraba datos por un mismatch de forma, un módulo entero (Configuración) mostrando errores de validación como JSON crudo en vez de mensajes legibles, y el módulo de Administración nunca escribiendo al log de auditoría pese a que otros módulos sí lo hacían.

## Dónde GLPI todavía tiene más superficie (honestidad, no marketing)

- **SAML**: GLPI lo soporta vía plugin de terceros (no en el core); esta plataforma lo dejó fuera por decisión explícita de seguridad/alcance, no por limitación técnica.
- **Sistema de plugins de terceros**: GLPI tiene un ecosistema de plugins de la comunidad acumulado en 20+ años; esta plataforma no lo tiene por la decisión de seguridad ya explicada (extensibilidad vía API/Webhooks en su lugar).
- **OAuth2 como authorization server completo**: GLPI puede actuar como IdP OAuth2; esta plataforma usa bearer tokens simples (suficiente para el modelo de negocio de scripts propios del cliente, no para ser IdP de terceros).
- **Volumen de configuración/edge cases acumulados**: GLPI cubre dos décadas de casos borde reportados por su comunidad; esta plataforma, al ser nueva, no tiene ese historial — mitigado por la cobertura de tests descrita arriba, pero es una diferencia real de madurez temporal, no de arquitectura.

## Plugins de GLPI: cuáles son gratis y cuáles se venden aparte

GLPI separa su catálogo de plugins en dos niveles (relevado directamente de [glpi-project.org/en/plugins](https://www.glpi-project.org/en/plugins/) y [glpi-project.org/en/pricing](https://www.glpi-project.org/en/pricing/)):

**Community (gratis, open source)**: GLPI Inventory, Data Injection, Formcreator, Fields, Gantt, Metabase, Centreon, LDAP Tools, JAMF, SCCM, Database Inventory, Tags, News, PDF, Order, Escalade, Crédit, Uninstall, Advanced Forms, Advanced Planning, More Reporting, Treeview, Use Items Export, Generic Object, y otros — todo instalable sin costo.

**Exclusive (requieren suscripción paga GLPI Network — planes Basic desde $100/mes hasta Advanced $1.000/mes)**: OAuthSSO, SCIM, GLPI-AI, AdvancedDashboard, ApprovalByMail, Cloud Inventory, Translate (traducción vía DeepL), Branding, WhatsApp, GDPR Tools, Anonymize, Renamer, Unread, PowerDNS, Holiday, Collaborativetools, Splitcat, GLPI Android Agent Config.

**Lectura para esta plataforma**: varios de los plugins "Exclusive" de GLPI (SSO/SCIM empresarial, dashboards avanzados, aprobación por email, inventario de nube) son candidatos naturales a construirse **incluidos** (no como upsell de suscripción por tiers) — varios módulos ya cubren el terreno funcional adyacente:
- **AdvancedDashboard** → ya existe una base sólida (`packages/core/src/dashboards/`, `/tools/dashboards`); ampliarlo compite directo con el tier pago de GLPI sin costo extra al cliente.
- **ApprovalByMail** → el motor de notificaciones (`packages/core/src/notifications/`) y las validaciones ITIL (`itil_validations`, ya usadas en Changes) son la base directa; falta el lado "aprobar respondiendo un email" (parsear la respuesta entrante).
- **Cloud Inventory** → no hay soporte de inventario AWS/Azure/GCP todavía; sería un módulo nuevo, no una extensión de algo existente.
- **OAuthSSO/SCIM** → el core de auth ya soporta OIDC genérico (ver arriba); SCIM (provisioning automático de usuarios desde un IdP) es la pieza que falta.
- **GLPI-AI** → GLPI no publica el detalle exacto de qué hace; queda como signo de interrogación, no como gap concreto y accionable.

**Lectura de los plugins "Community" (gratis) — cuáles faltan de verdad vs. cuáles ya están cubiertos de fábrica** (cruzado contra el código real, no solo el nombre):

- **Faltantes con valor de negocio claro**:
  - *Data Injection* (importación masiva CSV) — no existe hoy. Alto valor: onboarding de un cliente nuevo con inventario/usuarios existentes es 100% manual sin esto.
  - *Carbon* (huella de carbono de activos) — el módulo `impact` que ya existe (`packages/core/src/impact/`) es análisis de **dependencias** (si A falla, impacta a B), no ambiental — son conceptos distintos, esto sigue siendo un gap real. Ángulo ESG cada vez más pedido en RFPs corporativos.
  - *PDF* (exportar reportes) — no hay generación de PDF en ningún lado del código; `/tools/reports` solo muestra tablas en pantalla.
  - *Gantt* — el dato ya existe (`projectTasks` con fechas/estado/dependencias vía `projectTaskLinks`), falta solo la visualización — relativamente barato de agregar sobre lo que ya está.
- **Ya cubiertos, con otro nombre**: *Fields* (activos dinámicos, más flexible que el plugin), *LDAP Tools* (`auth-sources`), *Database Inventory* (tipo de activo `database`), *Treeview* (entidades ya en `ltree`, falta solo el componente visual).
- **Alto esfuerzo / bajo ROI para el modelo actual**: SCCM, JAMF, Centreon — integraciones enterprise pesadas, solo valen la pena si un cliente grande concreto las pide.

Prioridad sugerida: **Data Injection primero** (afecta el costo de onboarding de cada cliente, que es el negocio real), después **PDF export** (barato, esperado por cualquier ITSM).

## Por qué importa para el negocio (instalación on-premise por cliente)

El modelo de negocio de este producto es **vender e instalar** la plataforma en infraestructura de cada cliente (Docker on-prem), no operar un SaaS centralizado. Esto hace que las ventajas de arquitectura de arriba tengan impacto directo en el costo operativo real:

- Menos superficie de ataque por instalación (sin plugins de terceros ejecutando código arbitrario) = menos riesgo de tener que salir a parchear una instalación de cliente por una vulnerabilidad de un plugin que ni el equipo escribió.
- Tipado de punta a punta = menos clases enteras de bugs de producción detectables antes de cada release, relevante cuando cada cliente corre su propia versión desplegada (no hay un solo entorno centralizado donde parchear rápido).
- Un solo lenguaje (TypeScript) en todo el stack = el equipo de implementación no necesita mantener expertise en PHP + JS separados para soportar cada instalación.
