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
(
  cd /app/migrator
  pnpm --filter @itsm/db migrate
)
echo "[entrypoint] Migrations applied."

echo "[entrypoint] Starting web server (apps/web/server.js)..."
exec node apps/web/server.js
