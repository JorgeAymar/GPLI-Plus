# Despliegue de producción — glpi-plus.labshub.cc

Instancia real de GLPI-Plus corriendo en un VPS compartido junto a ~50 sitios y servicios más del mismo operador (n8n, mailcow, Supabase, WordPress, otras apps Next.js). Este documento cubre la instalación, actualización y configuración de **esta instancia específica**. Para el proceso genérico de despliegue on-premise, ver [`../README.md`](../README.md#producción-instalación-on-premise-vía-docker).

## Contenido

- [Datos de la instancia](#datos-de-la-instancia)
- [Por qué Docker Compose y no Swarm](#por-qué-docker-compose-y-no-swarm)
- [Instalación desde cero](#instalación-desde-cero)
- [Configurar `.env.production`](#configurar-envproduction)
- [Actualizar](#actualizar)
- [nginx + SSL](#nginx--ssl)
- [Comandos de diagnóstico](#comandos-de-diagnóstico)
- [Rollback de emergencia](#rollback-de-emergencia)

## Datos de la instancia

| | |
|---|---|
| URL pública | `https://glpi-plus.labshub.cc` |
| Servidor | VPS compartido — acceso por SSH solo con clave pública. IP, puerto y usuario **no se publican** en este repo (es público): pedirlos al dueño del proyecto. Abajo se usan `<SSH_PORT>` y `<USER>@<HOST>` |
| Directorio del repo | `/opt/glpi-plus` (clon git; `origin` = GitHub) |
| Stack | Docker Compose plano, proyecto `itsm` → contenedores `itsm-postgres-1`, `itsm-web-1`, `itsm-worker-1` |
| Red | `itsm_itsm_internal` (bridge, subnet fija `10.10.30.0/24`) |
| Volúmenes | `itsm_itsm_postgres_data` (base) e `itsm_itsm_documents_data` (adjuntos), externos |
| Puerto publicado (`web`) | `127.0.0.1:8120` → nginx → `443` |
| Reverse proxy | nginx — vhost en `/etc/nginx/sites-available/glpi-plus.labshub.cc` |
| SSL | Let's Encrypt vía certbot (auto-renovación configurada) |
| SMTP saliente | `mail.labshub.cc:587` (mailcow, corre en el mismo VPS) |
| Admin inicial | Email y contraseña entregados al dueño del proyecto fuera de este repo; nunca en ningún archivo versionado |

## Por qué Docker Compose y no Swarm

Hasta el 2026-10-10 esta instancia corría como stack de Docker Swarm. Se migró a Compose plano (commit `aa761f9`) porque **Swarm es incompatible con la opción `live-restore` del daemon de Docker**, que mantiene los contenedores corriendo cuando el daemon se reinicia (por ejemplo, en una actualización de Docker). En un VPS con ~50 servicios más, `live-restore` pesa más que lo que aportaba Swarm.

Consecuencias que hay que tener presentes:

- **Cada deploy tiene unos segundos de corte**: `docker compose up -d` para el contenedor viejo de `web` y arranca el nuevo. Ya no hay rolling update `start-first`.
- **No hay rollback automático**: si el contenedor nuevo no queda healthy, `deploy.sh` falla y muestra los logs, pero el viejo ya no existe. Ver [Rollback de emergencia](#rollback-de-emergencia).
- Los volúmenes se crearon con el stack de Swarm y por eso conservan el prefijo `itsm_itsm_`. `docker-compose.prod.yml` los declara `external` con ese nombre exacto para no perder datos.
- `docker-compose.prod.host-network.yml` quedó obsoleto: solo servía para el routing mesh de Swarm, que en este host no funcionaba. Ya no se usa.

## Instalación desde cero

### 1. Requisitos ya presentes en el host

Docker Engine, el plugin Docker Compose, nginx (`sites-available`/`sites-enabled`) y certbot ya estaban instalados como parte de la infraestructura compartida del VPS. El daemon tiene `live-restore` activado y **no** debe estar en modo Swarm (`docker info --format '{{.Swarm.LocalNodeState}}'` → `inactive`).

### 2. Clonar el código

```bash
git clone https://github.com/JorgeAymar/GPLI-Plus.git /opt/glpi-plus
```

`scripts/deploy.sh` usa `git rev-parse --short HEAD` para taguear cada imagen con el commit que la generó, así que el directorio tiene que ser un repo git.

### 3. Crear los volúmenes externos (solo en un host nuevo)

`docker-compose.prod.yml` espera volúmenes que ya existen. En un host que nunca tuvo el stack de Swarm hay que crearlos a mano una vez:

```bash
docker volume create itsm_itsm_postgres_data
docker volume create itsm_itsm_documents_data
```

### 4. Configurar `.env.production` y `.env`

Ver la sección dedicada [más abajo](#configurar-envproduction).

### 5. Primer deploy

```bash
cd /opt/glpi-plus
./scripts/deploy.sh
```

El script:

1. Exige `.env.production` en la raíz del repo.
2. Genera `.env.worker` (todo `.env.production` menos los secretos) y `secrets/itsm_database_url`, `secrets/itsm_smtp_password` y `secrets/itsm_ai_api_key`. Los archivos de `secrets/` quedan con dueño uid `1001` (el usuario del contenedor del worker) y modo `440`. El worker los lee al arrancar vía las variables `*_FILE` (`apps/worker/src/load-secrets.ts`).
3. Construye `itsm-web:<sha>` e `itsm-worker:<sha>`.
4. Corre `docker compose -p itsm -f docker-compose.prod.yml up -d`.
5. Espera hasta 180 s a que `postgres` y `web` estén `healthy` y `worker` esté `running`, y después hace un chequeo de estabilidad de 10 s para detectar un crash-loop.

Al arrancar, el contenedor `web` aplica las migraciones de Drizzle antes de levantar el servidor (`apps/web/docker-entrypoint.sh`, con reintentos y backoff).

### 6. Poblar datos iniciales (seed)

El seed (entidad raíz, perfil Super-Admin, usuario admin, catálogos base) no corre automáticamente: la imagen final de `web` es deliberadamente mínima y no trae `packages/core`. Se ejecuta una sola vez con un contenedor efímero construido desde el stage `builder`:

```bash
cd /opt/glpi-plus
docker build -f apps/web/Dockerfile --target builder -t itsm-seed-builder .
docker run --rm --network itsm_itsm_internal --env-file .env.production \
  itsm-seed-builder sh -c 'cd packages/core && pnpm exec tsx scripts/seed.ts'
```

La red es bridge, así que un `docker run` normal se puede unir a ella (con Swarm hacía falta `docker service create`). El seed es **idempotente**: correrlo de nuevo sobre una base ya poblada no duplica nada.

### 7. nginx + SSL

Ver la [sección dedicada](#nginx--ssl) más abajo.

## Configurar `.env.production`

Vive únicamente en el servidor (`/opt/glpi-plus/.env.production`, permisos `600`, dueño `root`). Nunca se commitea (`.gitignore` lo excluye vía la regla `.env.*`) ni pasa por ningún chat en texto plano una vez guardado. `.env.production.example` en la raíz del repo documenta cada variable sin valores reales.

| Variable | Qué es | Cómo se generó acá |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | Usuario/nombre de la base | `itsm` / `itsm` (fijos) |
| `POSTGRES_PASSWORD` | Contraseña de Postgres | `openssl rand -hex 24` — nunca la de desarrollo |
| `DATABASE_URL` | Connection string que usa la app | `postgres://itsm:<POSTGRES_PASSWORD>@postgres:5432/itsm` — el host **debe** ser `postgres` (nombre del servicio en la red `itsm_itsm_internal`), no `localhost` |
| `AUTH_SECRET` | Firma de las sesiones JWT (Auth.js) | `openssl rand -base64 32` — nunca la de desarrollo |
| `AUTH_URL` | URL pública de la app | `https://glpi-plus.labshub.cc` |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_PATH` | Adapter de almacenamiento de adjuntos | `local` / `./.data/documents` (único driver implementado hoy) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Cuenta admin creada por el seed | Contraseña propia generada para producción. **Nunca** `ChangeMe123!`: es la de desarrollo y está publicada en este repo |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Envío de correo saliente (notificaciones, recuperación de contraseña) | `mail.labshub.cc:587`, STARTTLS (`SMTP_SECURE=false`), cuenta de mailcow en el mismo VPS |
| `AI_API_KEY` (opcional) | Clave del asistente IA, si se usa | Llega al worker como secreto (`secrets/itsm_ai_api_key`) |

**Puerto publicado (`.env`, sin sufijo).** `docker compose` lee `.env` del directorio del proyecto para resolver variables *dentro* de `docker-compose.prod.yml` (como `${WEB_PUBLISHED_PORT}`). `.env.production` no sirve para eso, porque solo llega a los contenedores vía `env_file:`. En este host `/opt/glpi-plus/.env` contiene únicamente:

```bash
WEB_PUBLISHED_PORT=8120   # rango 80xx/81xx; nunca 8080 (ya usado por otro servicio del host)
```

Sin ese archivo el puerto cae al valor por defecto `3000` y nginx deja de encontrar la app.

`.env.worker` y `secrets/` se regeneran en cada deploy desde `.env.production`: no se editan a mano. Ninguno de los tres se commitea (`secrets/` está en `.gitignore`).

## Actualizar

El código llega al servidor **por git**, nunca con `rsync --delete`. Un `rsync` desde un equipo local pisaría `.env`, `.env.production` y `secrets/` (que solo existen en el servidor) y borraría cualquier commit hecho directamente en el servidor que no esté en el equipo local.

### Opción A: desde GitHub (lo normal)

Si el cambio ya está en `main` en GitHub:

```bash
ssh -p <SSH_PORT> -o PreferredAuthentications=publickey <USER>@<HOST>
cd /opt/glpi-plus
git status                      # tiene que estar limpio
git pull --ff-only origin main
./scripts/deploy.sh
```

### Opción B: empujar desde el equipo local por SSH

Útil cuando el commit todavía no está en GitHub. El repo del servidor pertenece a otro uid (viene de una copia inicial con `rsync`), así que git exige `safe.directory`. Se pasa por comando para no tocar la configuración global del servidor:

```bash
# En el equipo local: traer lo que haya en el servidor e integrarlo
GIT_SSH_COMMAND="ssh -p <SSH_PORT>" git fetch \
  --upload-pack="git -c safe.directory='*' upload-pack" \
  ssh://<USER>@<HOST>/opt/glpi-plus main:refs/remotes/server/main
git rebase server/main

# Empujar a una rama temporal (no se puede empujar a la rama que el servidor tiene checkout)
GIT_SSH_COMMAND="ssh -p <SSH_PORT>" git push \
  --receive-pack="git -c safe.directory='*' receive-pack" \
  ssh://<USER>@<HOST>/opt/glpi-plus main:refs/heads/incoming

# En el servidor: avanzar main y desplegar
ssh -p <SSH_PORT> <USER>@<HOST> 'cd /opt/glpi-plus \
  && git -c safe.directory="*" merge --ff-only incoming \
  && git -c safe.directory="*" branch -d incoming \
  && ./scripts/deploy.sh'
```

Después, subir el mismo `main` a GitHub para que servidor, local y GitHub no diverjan.

### Verificar el deploy

```bash
curl -s https://glpi-plus.labshub.cc/api/health              # {"status":"ok"}
docker compose -p itsm -f docker-compose.prod.yml ps          # web/worker con el <sha> nuevo
docker logs --since 5m itsm-web-1 2>&1 | grep -iE 'error|fail'
```

**Migraciones.** Ya no hay ventana con contenedor viejo y nuevo sirviendo a la vez, pero los cambios de schema tienen que seguir siendo retro-compatibles por al menos una versión: es lo que permite volver a la imagen anterior (ver rollback) sin que se rompa contra el schema ya migrado. Las migraciones de Drizzle no se revierten solas.

## nginx + SSL

Vhost en `/etc/nginx/sites-available/glpi-plus.labshub.cc`, mismo patrón que el resto del servidor (headers de seguridad, rate limit `perip` ya definido globalmente, proxy a loopback):

```nginx
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name glpi-plus.labshub.cc;

  ssl_certificate     /etc/letsencrypt/live/glpi-plus.labshub.cc/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/glpi-plus.labshub.cc/privkey.pem;
  include /etc/letsencrypt/options-ssl-nginx.conf;
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

  limit_req zone=perip burst=30 nodelay;
  client_max_body_size 50m;

  location / {
    proxy_pass http://127.0.0.1:8120;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  listen [::]:80;
  server_name glpi-plus.labshub.cc;

  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / { return 301 https://$host$request_uri; }
}
```

Certificado emitido con `certbot --nginx -d glpi-plus.labshub.cc` — renovación automática ya configurada por certbot (tarea programada del sistema, sin acción manual necesaria).

**Antes de cualquier `systemctl reload nginx` en este servidor**: siempre `nginx -t` primero — hay ~50 sitios más dependiendo de la misma configuración global; un error de sintaxis en el vhost nuevo puede tumbar el reload de todos. (`nginx -t` va a mostrar warnings de sitios preexistentes que no son tuyos — solo importa que termine en "syntax is ok" / "test is successful".)

## Comandos de diagnóstico

Todos desde `/opt/glpi-plus`:

```bash
# Estado del stack (imagen, estado y health de cada contenedor)
docker compose -p itsm -f docker-compose.prod.yml ps

# Logs en vivo
docker logs -f itsm-web-1
docker logs -f itsm-worker-1

# Por qué un contenedor no queda healthy (último resultado del HEALTHCHECK)
docker inspect --format '{{json .State.Health}}' itsm-web-1

# El puerto publicado responde desde el propio servidor (bypasea nginx/SSL/DNS)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8120/api/health

# Reiniciar solo el worker (sin tocar web)
docker compose -p itsm -f docker-compose.prod.yml restart worker

# Consola SQL
docker exec -it itsm-postgres-1 psql -U itsm -d itsm
```

## Rollback de emergencia

`deploy.sh` siempre construye desde `HEAD`, así que para volver atrás se usa Compose directamente con el tag de una imagen anterior. Las imágenes viejas quedan en el daemon salvo que se hayan podado con `docker image prune`:

```bash
cd /opt/glpi-plus
docker images itsm-web --format '{{.Tag}}'       # tags disponibles (= sha corto de cada deploy)
IMAGE_TAG=<sha-anterior> docker compose -p itsm -f docker-compose.prod.yml up -d
```

`secrets/` y `.env.worker` ya existen del deploy anterior, así que no hace falta regenerarlos. Si la versión mala trajo una migración que la anterior no tolera, el rollback de imagen no alcanza y hay que restaurar la base desde backup.

- Bajar el stack completo sin borrar datos (los volúmenes son externos y sobreviven): `docker compose -p itsm -f docker-compose.prod.yml down`. **Nunca** agregar `-v`.
