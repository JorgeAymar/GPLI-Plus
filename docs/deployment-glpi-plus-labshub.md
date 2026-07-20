# Despliegue de producción — glpi-plus.labshub.cc

Instancia real de GLPI-Plus corriendo en un VPS compartido junto a ~50 sitios y servicios más del mismo operador (n8n, mailcow, Supabase, WordPress, otras apps Next.js). Este documento cubre la instalación, actualización y configuración de **esta instancia específica**. Para el proceso genérico de despliegue on-premise, ver [`../README.md`](../README.md#producción-instalación-on-premise-vía-docker) — la arquitectura base (Docker Swarm, imágenes, healthcheck) es la misma; lo que cambia acá es una particularidad de red de este host puntual, documentada en la sección correspondiente más abajo.

## Contenido

- [Datos de la instancia](#datos-de-la-instancia)
- [Instalación desde cero](#instalación-desde-cero)
- [Configurar `.env.production`](#configurar-envproduction)
- [Actualizar](#actualizar)
- [Particularidad de este host: routing mesh de Swarm no funcional](#particularidad-de-este-host-routing-mesh-de-swarm-no-funcional)
- [nginx + SSL](#nginx--ssl)
- [Comandos de diagnóstico](#comandos-de-diagnóstico)
- [Rollback de emergencia](#rollback-de-emergencia)

## Datos de la instancia

| | |
|---|---|
| URL pública | `https://glpi-plus.labshub.cc` |
| Servidor | VPS `217.216.49.191` — `ssh -p 9022 root@217.216.49.191` (solo clave pública) |
| Directorio del repo | `/opt/glpi-plus` |
| Stack | Docker Swarm (single-node), nombre del stack `itsm` |
| Puerto publicado (`web`) | `127.0.0.1:8120` → nginx → `443` |
| Reverse proxy | nginx — vhost en `/etc/nginx/sites-available/glpi-plus.labshub.cc` |
| SSL | Let's Encrypt vía certbot (auto-renovación configurada) |
| SMTP saliente | `mail.labshub.cc:587` (mailcow, corre en el mismo VPS) |
| Admin inicial | `glpi-plus@labshub.cc` — contraseña entregada al dueño del proyecto fuera de este repo; nunca en texto plano en ningún archivo versionado ni en este documento |

## Instalación desde cero

### 1. Requisitos ya presentes en el host

Docker Engine, Docker Compose, nginx (`sites-available`/`sites-enabled`) y certbot ya estaban instalados como parte de la infraestructura compartida del VPS — no se instaló nada adicional a nivel de sistema.

### 2. Activar Docker Swarm (una sola vez)

```bash
docker swarm init
```

Cambio de estado local del daemon Docker, reversible en cualquier momento con `docker swarm leave --force`. No afecta a los demás contenedores del host, que corren fuera de Swarm.

### 3. Copiar el código al servidor

```bash
rsync -az -e "ssh -p 9022" \
  --exclude node_modules --exclude .next --exclude test-results --exclude .turbo \
  ./ root@217.216.49.191:/opt/glpi-plus/
```

Se incluye `.git/` en la sincronización (no se excluye) porque `scripts/deploy.sh` necesita `git rev-parse --short HEAD` para taguear cada imagen con el commit que la generó.

### 4. Configurar `.env.production`

Ver la sección dedicada [más abajo](#configurar-envproduction).

### 5. Primer deploy

```bash
cd /opt/glpi-plus
./scripts/deploy.sh
```

Construye ambas imágenes (`itsm-web`, `itsm-worker`), las despliega con `docker stack deploy`, y espera activamente a que el rollout converja antes de reportar éxito.

**En este host específico**, el primer intento falló por dos problemas de red propios de un servidor con ~50 redes Docker ya creadas — ambos ya corregidos de forma permanente en el repo (no hace falta repetir el diagnóstico en el próximo deploy):

- Pool de subredes de Docker agotado → `docker-compose.prod.yml` fija un subnet explícito para la red `itsm_internal` en vez de dejar que Docker lo auto-asigne.
- El routing mesh de Swarm (modo `ingress`) nunca programó la regla de reenvío del puerto publicado → ver [la sección dedicada](#particularidad-de-este-host-routing-mesh-de-swarm-no-funcional) para el porqué y el overlay que lo resuelve.

### 6. Poblar datos iniciales (seed)

El seed (entidad raíz, perfil Super-Admin, usuario admin, catálogos base) no corre automáticamente dentro del contenedor `web` en runtime — se ejecuta una sola vez, como un servicio Swarm efímero que sí trae `packages/core` completo (a diferencia de la imagen final de `web`, que es deliberadamente mínima):

```bash
# Construir una imagen con el código fuente completo (usa el stage "builder" del Dockerfile de web)
docker build -f apps/web/Dockerfile --target builder -t itsm-seed-builder .

# Correrlo como servicio Swarm (un `docker run` normal no puede unirse a una red overlay
# administrada por Swarm - "not manually attachable" - por eso se usa `service create`)
docker service create --name itsm-seed-oneoff \
  --network itsm_itsm_internal \
  --env-file .env.production \
  --restart-condition none --detach=false \
  itsm-seed-builder sh -c 'cd packages/core && pnpm exec tsx scripts/seed.ts'

# Revisar el resultado y limpiar el servicio efímero (ya cumplió su función)
docker service logs itsm-seed-oneoff
docker service rm itsm-seed-oneoff
```

El seed es **idempotente** — correrlo de nuevo sobre una base ya poblada no duplica nada, solo confirma que cada pieza (entidad, perfil, plantillas de notificación) ya existe.

### 7. nginx + SSL

Ver la [sección dedicada](#nginx--ssl) más abajo.

## Configurar `.env.production`

Vive únicamente en el servidor (`/opt/glpi-plus/.env.production`, permisos `600`, dueño `root`) — nunca se commitea (`.gitignore` lo excluye vía la regla `.env.*`) ni pasa por ningún chat en texto plano una vez guardado. `.env.production.example` en la raíz del repo documenta cada variable sin valores reales.

| Variable | Qué es | Cómo se generó acá |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | Usuario/nombre de la base | `itsm` / `itsm` (fijos) |
| `POSTGRES_PASSWORD` | Contraseña de Postgres | `openssl rand -hex 24` — nunca la de desarrollo |
| `DATABASE_URL` | Connection string que usa la app | `postgres://itsm:<POSTGRES_PASSWORD>@postgres:5432/itsm` — el host **debe** ser `postgres` (nombre del servicio en la red overlay), no `localhost` |
| `AUTH_SECRET` | Firma de las sesiones JWT (Auth.js) | `openssl rand -base64 32` — nunca la de desarrollo |
| `AUTH_URL` | URL pública de la app | `https://glpi-plus.labshub.cc` |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_PATH` | Adapter de almacenamiento de adjuntos | `local` / `./.data/documents` (único driver implementado hoy) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Cuenta admin creada por el seed | `admin@itsm.local` / `ChangeMe123!` (credenciales de desarrollo estándar, usadas también en prod por instrucción explícita — cambiar cuanto antes vía "Olvidé mi contraseña") |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Envío de correo saliente (notificaciones, recuperación de contraseña) | `mail.labshub.cc:587`, STARTTLS (`SMTP_SECURE=false`), cuenta de mailcow en el mismo VPS |
| `WEB_PUBLISHED_PORT` | Puerto del host donde nginx encuentra la app | `8120` — en rango `80xx`/`81xx`, nunca `8080` (ya usado por otro servicio del host) |

**Importante — `docker stack deploy` no lee `.env.production` para sustituir variables en el propio `docker-compose.prod.yml`** (ej. `${WEB_PUBLISHED_PORT}`). Eso solo pasa vía `env_file:` *dentro* de los contenedores ya corriendo. Para que el YAML mismo resuelva `${WEB_PUBLISHED_PORT}` al desplegar, hace falta un archivo `.env` (sin sufijo) en el directorio de trabajo, o exportar la variable en el mismo comando:

```bash
# Cualquiera de las dos formas funciona - la segunda es más explícita en el momento del deploy
echo "WEB_PUBLISHED_PORT=8120" > /opt/glpi-plus/.env
# o
export WEB_PUBLISHED_PORT=8120
```

## Actualizar

```bash
# 1. Traer el código nuevo
rsync -az --delete -e "ssh -p 9022" \
  --exclude node_modules --exclude .next --exclude test-results --exclude .turbo \
  ./ root@217.216.49.191:/opt/glpi-plus/

# 2. Desde el VPS, con la variable de puerto ya exportada (ver arriba)
ssh -p 9022 root@217.216.49.191
cd /opt/glpi-plus
export WEB_PUBLISHED_PORT=8120
docker stack deploy -c docker-compose.prod.yml -c docker-compose.prod.host-network.yml itsm
```

**El segundo `-c` es obligatorio en este host** (ver la sección siguiente) — sin él, el deploy vuelve a fallar con el mismo problema de routing ya resuelto.

**Caveat de migraciones** (aplica a cualquier deploy sin downtime real, no es específico de este stack): durante la ventana de transición el contenedor viejo puede seguir sirviendo con el schema anterior mientras el nuevo ya corrió las migraciones. Cambios de schema deben ser retro-compatibles por al menos un deploy.

## Particularidad de este host: routing mesh de Swarm no funcional

`docker-compose.prod.yml` está diseñado para actualizaciones **sin downtime real** vía el modo `ingress` de Swarm (`update_config.order: start-first` — el contenedor nuevo arranca y pasa el healthcheck antes de apagar el viejo, sin nunca soltar el puerto publicado). Ese diseño es correcto y es el que debe usarse en cualquier host donde el routing mesh de Swarm funcione normalmente.

**En este VPS puntual, no funciona.** Diagnóstico confirmado durante la instalación:

- El módulo de kernel `ip_vs` (IPVS, lo que usa Swarm para el routing mesh) estaba cargado.
- La cadena de iptables `DOCKER-INGRESS` existía, pero **nunca se programó ninguna regla de reenvío** para el puerto publicado — ni siquiera `curl` desde `127.0.0.1` en el propio servidor llegaba al contenedor, a pesar de que el contenedor respondía perfecto (`200 OK`) probado desde adentro.
- Ningún otro servicio de este host usa Swarm: los ~50 contenedores restantes corren vía `docker run`/`docker compose` plano con `docker-proxy` reenviando puertos directamente — un mecanismo distinto, y el único que se probó funcionando en este servidor.

`docker-compose.prod.host-network.yml` es un overlay opcional (pensado para ser reutilizable en cualquier cliente con el mismo problema, no un parche de un solo uso) que cambia la publicación del puerto de `web` al modo `mode: host` de Swarm — el mismo mecanismo simple (`docker-proxy`) que ya funciona para todo lo demás en este host, evitando el routing mesh roto por completo.

**Trade-off, explícito**: con `mode: host`, dos contenedores no pueden mantener el mismo puerto del host simultáneamente — por eso el overlay también cambia `update_config.order` a `stop-first`. Los deploys en este host puntual tienen una breve interrupción real (se para el viejo, arranca el nuevo) en vez del rollout sin downtime que el diseño base ofrece en un host con routing mesh sano. Dado que las actualizaciones son poco frecuentes y manuales (nunca automáticas), este trade-off se consideró aceptable frente a seguir depurando una capa de red rota en un servidor de producción compartido con otros ~50 sitios en vivo.

Si en el futuro se resuelve el routing mesh de este host (o se migra a un VPS dedicado), alcanza con dejar de pasar el segundo `-c docker-compose.prod.host-network.yml` para volver al comportamiento zero-downtime por defecto.

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

```bash
# Estado del stack completo
docker stack services itsm

# Por qué un contenedor no arranca (siempre --no-trunc, el mensaje de error se corta si no)
docker service ps itsm_web --no-trunc

# Logs en vivo
docker service logs -f itsm_web
docker service logs -f itsm_worker

# El puerto publicado responde desde el propio servidor (bypasea nginx/SSL/DNS)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8120/api/health

# Reiniciar solo el worker (sin tocar web)
docker service update --force itsm_worker
```

## Rollback de emergencia

- Volver a una imagen anterior: `IMAGE_TAG=<sha-corto-anterior> docker stack deploy -c docker-compose.prod.yml -c docker-compose.prod.host-network.yml itsm` (las imágenes viejas quedan en el daemon local salvo que se hayan podado con `docker image prune`).
- Sacar el stack completo (no borra volúmenes — la base de datos y los documentos sobreviven): `docker stack rm itsm`.
- Salir de Swarm mode por completo (solo afecta este mecanismo, no a los demás contenedores del VPS que corren fuera de Swarm): `docker swarm leave --force`.
