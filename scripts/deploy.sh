#!/usr/bin/env bash
# Build + deploy for the on-premise production stack (plain Docker Compose).
#
# 1. Derives .env.worker and ./secrets/* (worker file secrets) from .env.production.
# 2. Builds itsm-web and itsm-worker images tagged with the current short git SHA.
# 3. `docker compose -p itsm -f docker-compose.prod.yml up -d`.
# 4. Waits until postgres/web are healthy and worker is running, then checks
#    they are still up after a short stability window (crash-loop detection).
#
# Usage:
#   ./scripts/deploy.sh
#
# Same command for the first install and every update. NOT zero-downtime:
# compose stops the old web container before starting the new one (a few
# seconds of downtime), and there is no automatic rollback - see README.md,
# "Producción", for the manual IMAGE_TAG=<old-sha> rollback.

set -euo pipefail

cd "$(dirname "$0")/.."

STACK_NAME="itsm"
COMPOSE_FILE="docker-compose.prod.yml"
TIMEOUT_SECONDS=180
POLL_INTERVAL=3
INITIAL_DELAY_SECONDS=5
WORKER_TIMEOUT_SECONDS=60
WORKER_STABILITY_CHECK_SECONDS=10


if [ ! -f ".env.production" ]; then
  echo "ERROR: .env.production not found in repo root." >&2
  echo "Copy .env.production.example to .env.production and fill in real values first." >&2
  exit 1
fi

# Worker env file: everything in .env.production except the keys that reach the
# worker as file secrets under ./secrets (or that it doesn't use at all).
grep -v -E '^(DATABASE_URL|SMTP_PASSWORD|AI_API_KEY|POSTGRES_PASSWORD|SEED_ADMIN_PASSWORD|AUTH_SECRET)=' .env.production > .env.worker
chmod 600 .env.worker
mkdir -p secrets && chmod 700 secrets
for pair in itsm_database_url:DATABASE_URL itsm_smtp_password:SMTP_PASSWORD itsm_ai_api_key:AI_API_KEY; do
  name="${pair%%:*}"; key="${pair##*:}"
  ( umask 077; grep "^${key}=" .env.production | cut -d= -f2- | tr -d '\n' > "secrets/${name}" )
  # The worker container runs as uid 1001 ("worker", see apps/worker/Dockerfile);
  # plain-compose file secrets are bind mounts, so ownership/mode must allow it.
  chown 1001:1001 "secrets/${name}" && chmod 440 "secrets/${name}"
done

IMAGE_TAG="$(git rev-parse --short HEAD)"
export IMAGE_TAG

if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: working tree has uncommitted changes. IMAGE_TAG=${IMAGE_TAG} is the" >&2
  echo "         short SHA of the last commit, NOT of what's actually being built —" >&2
  echo "         if an image with this tag already exists, this deploy may silently" >&2
  echo "         no-op instead of picking up your uncommitted changes." >&2
fi

echo "==> Building itsm-web:${IMAGE_TAG} ..."
docker build -f apps/web/Dockerfile -t "itsm-web:${IMAGE_TAG}" .

echo "==> Building itsm-worker:${IMAGE_TAG} ..."
docker build -f apps/worker/Dockerfile -t "itsm-worker:${IMAGE_TAG}" .

echo "==> Starting stack '${STACK_NAME}' (IMAGE_TAG=${IMAGE_TAG}) ..."
docker compose -p "${STACK_NAME}" -f "${COMPOSE_FILE}" up -d

wait_running() { # $1=service, $2=timeout seconds
  local svc="$1" timeout="$2" waited=0 cid state
  while [ "${waited}" -lt "${timeout}" ]; do
    cid="$(docker compose -p "${STACK_NAME}" -f "${COMPOSE_FILE}" ps -q "${svc}")"
    state="$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "${cid}" 2>/dev/null || true)"
    case "${state}" in "running healthy"|"running ") return 0 ;; esac
    sleep "${POLL_INTERVAL}"; waited=$((waited + POLL_INTERVAL))
  done
  echo "ERROR: ${svc} did not reach running state within ${timeout}s (last state: ${state})." >&2
  docker compose -p "${STACK_NAME}" -f "${COMPOSE_FILE}" logs --tail 30 "${svc}" >&2 || true
  return 1
}

for svc in postgres web worker; do
  echo "==> Waiting for ${svc} ..."
  wait_running "${svc}" "${TIMEOUT_SECONDS}" || exit 1
done

echo "==> Stability check (${WORKER_STABILITY_CHECK_SECONDS}s) ..."
sleep "${WORKER_STABILITY_CHECK_SECONDS}"
for svc in web worker; do
  wait_running "${svc}" 1 || { echo "ERROR: ${svc} is no longer running (crash loop?)." >&2; exit 1; }
done
echo "==> itsm-web:${IMAGE_TAG} and itsm-worker:${IMAGE_TAG} are running and stable."
docker compose -p "${STACK_NAME}" -f "${COMPOSE_FILE}" ps
