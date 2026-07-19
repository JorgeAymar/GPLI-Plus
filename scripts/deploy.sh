#!/usr/bin/env bash
# Zero-downtime build + deploy for the on-premise production stack.
#
# 1. Builds apps/web's Docker image tagged with the current short git SHA.
# 2. Deploys/updates the "itsm" Docker Swarm stack from docker-compose.prod.yml.
# 3. Waits for the rolling update to actually converge (new task healthy and
#    running, old task gone) before reporting success — a `docker stack
#    deploy` that returns immediately is NOT proof the update finished.
#
# One-time prerequisite: `docker swarm init` (see README.md, "Producción").
#
# Usage:
#   ./scripts/deploy.sh
#
# Every run — first install and every subsequent update — is the same
# command. Swarm's start-first update_config (docker-compose.prod.yml) is
# what makes re-running this zero-downtime: the new container must pass the
# Dockerfile's HEALTHCHECK (GET /api/health) before the old one is stopped.

set -euo pipefail

cd "$(dirname "$0")/.."

STACK_NAME="itsm"
COMPOSE_FILE="docker-compose.prod.yml"
SERVICE="${STACK_NAME}_web"
WORKER_SERVICE="${STACK_NAME}_worker"
TIMEOUT_SECONDS=180
POLL_INTERVAL=3
INITIAL_DELAY_SECONDS=5
WORKER_TIMEOUT_SECONDS=60
WORKER_STABILITY_CHECK_SECONDS=10

echo "==> Checking Docker Swarm is active..."
swarm_state="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "unknown")"
if [ "${swarm_state}" != "active" ]; then
  echo "ERROR: Docker Swarm is not active on this host (state: ${swarm_state})." >&2
  echo "Run 'docker swarm init' once — see README.md, section 'Producción'." >&2
  exit 1
fi

if [ ! -f ".env.production" ]; then
  echo "ERROR: .env.production not found in repo root." >&2
  echo "Copy .env.production.example to .env.production and fill in real values first." >&2
  exit 1
fi

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

echo "==> Deploying stack '${STACK_NAME}' (IMAGE_TAG=${IMAGE_TAG}) ..."
docker stack deploy -c "${COMPOSE_FILE}" "${STACK_NAME}"

# Give Swarm a moment to actually register the update before we start
# polling — otherwise the first iteration can read stale UpdateStatus left
# over from a *prior* deploy and misjudge convergence.
echo "==> Waiting ${INITIAL_DELAY_SECONDS}s before polling for convergence..."
sleep "${INITIAL_DELAY_SECONDS}"

echo "==> Waiting for rollout to converge (timeout: ${TIMEOUT_SECONDS}s) ..."
elapsed=0
while [ "${elapsed}" -lt "${TIMEOUT_SECONDS}" ]; do
  update_state="$(docker service inspect "${SERVICE}" --format '{{.UpdateStatus.State}}' 2>/dev/null || echo "")"

  if [ "${update_state}" = "rollback_completed" ] || [ "${update_state}" = "rollback_paused" ]; then
    echo "ERROR: Deploy failed health checks and was rolled back (UpdateStatus: ${update_state})." >&2
    echo "--- docker service ps ${SERVICE} ---" >&2
    docker service ps "${SERVICE}" --no-trunc >&2
    exit 1
  fi

  # Converged means: a task running the image we just built is, on that SAME
  # task line, actually in the "Running" state. This must NOT be two
  # independent whole-output greps (one for the tag, one for "Running") —
  # during the start-first transition window both the old task (image=old
  # tag, state=Running) and new task (image=new tag, state=Starting) can
  # appear together with desired-state=running, and two separate greps would
  # each match a *different* line and false-positive on convergence before
  # the new task is actually up.
  task_pattern="^itsm-web:${IMAGE_TAG}[^|]*\|.*[Rr]unning"
  task_converged=false
  while IFS= read -r line; do
    [ -z "${line}" ] && continue
    if [[ "${line}" =~ ${task_pattern} ]]; then
      task_converged=true
      break
    fi
  done < <(docker service ps "${SERVICE}" --filter "desired-state=running" \
    --format '{{.Image}}|{{.CurrentState}}' 2>/dev/null || true)

  if [ "${task_converged}" = true ]; then
    if [ "${update_state}" = "completed" ] || [ -z "${update_state}" ] || [ "${update_state}" = "<no value>" ]; then
      echo "==> Rollout converged: itsm-web:${IMAGE_TAG} is running and healthy."
      web_converged=true
      break
    fi
  fi

  sleep "${POLL_INTERVAL}"
  elapsed=$((elapsed + POLL_INTERVAL))
done

if [ "${web_converged:-false}" != true ]; then
  echo "ERROR: Timed out after ${TIMEOUT_SECONDS}s waiting for rollout to converge." >&2
  echo "--- docker service ps ${SERVICE} ---" >&2
  docker service ps "${SERVICE}" --no-trunc >&2
  exit 1
fi

# The worker service (background jobs: SLA escalation, notifications,
# recurring tickets, webhooks) has no HEALTHCHECK and no start-first update
# config — a stalled/crashing worker deploy would otherwise return exit 0
# here just because `web` came up fine, while jobs silently stop running.
# This is a lighter check than web's (no rollback semantics to wait on,
# since restart_policy: any handles that on its own): confirm a task on the
# new image tag reaches Running, then re-check a few seconds later that it's
# STILL Running (catches an immediate crash-loop, e.g. a bad DATABASE_URL).
echo "==> Waiting for itsm-worker:${IMAGE_TAG} to come up (timeout: ${WORKER_TIMEOUT_SECONDS}s) ..."
worker_pattern="^itsm-worker:${IMAGE_TAG}[^|]*\|.*[Rr]unning"
worker_elapsed=0
worker_up=false
while [ "${worker_elapsed}" -lt "${WORKER_TIMEOUT_SECONDS}" ]; do
  while IFS= read -r line; do
    [ -z "${line}" ] && continue
    if [[ "${line}" =~ ${worker_pattern} ]]; then
      worker_up=true
      break
    fi
  done < <(docker service ps "${WORKER_SERVICE}" --filter "desired-state=running" \
    --format '{{.Image}}|{{.CurrentState}}' 2>/dev/null || true)

  [ "${worker_up}" = true ] && break
  sleep "${POLL_INTERVAL}"
  worker_elapsed=$((worker_elapsed + POLL_INTERVAL))
done

if [ "${worker_up}" != true ]; then
  echo "ERROR: itsm-worker:${IMAGE_TAG} did not reach Running within ${WORKER_TIMEOUT_SECONDS}s." >&2
  echo "--- docker service ps ${WORKER_SERVICE} ---" >&2
  docker service ps "${WORKER_SERVICE}" --no-trunc >&2
  echo "--- docker service logs ${WORKER_SERVICE} (last 30 lines) ---" >&2
  docker service logs --tail 30 "${WORKER_SERVICE}" >&2 || true
  exit 1
fi

echo "==> Worker task is Running, confirming it's stable (waiting ${WORKER_STABILITY_CHECK_SECONDS}s) ..."
sleep "${WORKER_STABILITY_CHECK_SECONDS}"
still_up=false
while IFS= read -r line; do
  [ -z "${line}" ] && continue
  if [[ "${line}" =~ ${worker_pattern} ]]; then
    still_up=true
    break
  fi
done < <(docker service ps "${WORKER_SERVICE}" --filter "desired-state=running" \
  --format '{{.Image}}|{{.CurrentState}}' 2>/dev/null || true)

if [ "${still_up}" != true ]; then
  echo "ERROR: itsm-worker:${IMAGE_TAG} came up but is no longer Running (crash loop?)." >&2
  echo "--- docker service ps ${WORKER_SERVICE} ---" >&2
  docker service ps "${WORKER_SERVICE}" --no-trunc >&2
  echo "--- docker service logs ${WORKER_SERVICE} (last 30 lines) ---" >&2
  docker service logs --tail 30 "${WORKER_SERVICE}" >&2 || true
  exit 1
fi

echo "==> itsm-worker:${IMAGE_TAG} is running and stable."
docker stack services "${STACK_NAME}"
exit 0
