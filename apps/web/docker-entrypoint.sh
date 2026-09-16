#!/bin/sh
# Production entrypoint for the on-premise Docker image.
#
# 1. Applies pending @itsm/db (Drizzle) migrations against DATABASE_URL.
# 2. Starts the Next.js standalone server.
#
# Runs as the non-root "nextjs" user (see Dockerfile). Both steps must
# succeed for the container to be considered healthy.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set. Cannot run migrations." >&2
  exit 1
fi

echo "[entrypoint] Running @itsm/db migrations..."
# Retry with backoff instead of failing on the first attempt: on Swarm
# overlay networks, the "postgres" service name can take a few seconds to
# become DNS-resolvable/reachable after this container starts (confirmed
# flaky on glpi-plus.labshub.cc, the same host documented in
# docker-compose.prod.host-network.yml as having broken ingress routing).
# Without this, a transient connection failure here is fatal: the container
# exits, Swarm's restart_policy brings up a fresh one, migrations fail again
# for the same reason, and the service crash-loops indefinitely instead of
# recovering once the network settles.
migrate_attempts=10
migrate_delay=3
attempt=1
until (cd /app/migrator && pnpm --filter @itsm/db migrate); do
  if [ "${attempt}" -ge "${migrate_attempts}" ]; then
    echo "[entrypoint] ERROR: migrations failed after ${migrate_attempts} attempts. Giving up." >&2
    exit 1
  fi
  echo "[entrypoint] Migration attempt ${attempt}/${migrate_attempts} failed, retrying in ${migrate_delay}s..." >&2
  sleep "${migrate_delay}"
  attempt=$((attempt + 1))
  migrate_delay=$((migrate_delay * 2))
  [ "${migrate_delay}" -gt 30 ] && migrate_delay=30
done
echo "[entrypoint] Migrations applied."

echo "[entrypoint] Starting web server (apps/web/server.js)..."
exec node apps/web/server.js
