# syntax=docker/dockerfile:1
#
# Production image for apps/worker (pg-boss background job runner): SLA
# escalation, notification dispatch, recurring tickets, webhook dispatch,
# RSS feed refresh, and saved-search alerts (see apps/worker/src/index.ts,
# which registers all 6 jobs on startup).
#
#   docker build -f apps/worker/Dockerfile -t itsm-worker .
#
# apps/worker has no build step of its own — it runs straight off the
# TypeScript source via `tsx src/index.ts` (see the "dev"/"start" scripts in
# apps/worker/package.json), same as this monorepo's own dev flow. So unlike
# apps/web/Dockerfile there's no `next build`/`builder` stage here: the
# runner stage installs the workspace deps this service needs (including
# devDependencies, since tsx is one) and runs `pnpm --filter @itsm/worker
# start` directly.
#
# pg-boss manages its own schema inside the same Postgres database
# (`new PgBoss(process.env.DATABASE_URL)` in src/index.ts) — no Drizzle
# migration step is needed here the way apps/web/docker-entrypoint.sh needs
# one, so this image has no entrypoint script.
#
# Stages:
#   base   - Node + pnpm (corepack), shared by every other stage.
#   deps   - installs the workspace's node_modules for just the packages
#            this service needs (@itsm/worker, @itsm/core, @itsm/db) —
#            cached unless manifests or the lockfile change.
#   runner - final image: deps + full source for those 3 packages, non-root
#            user, runs `pnpm --filter @itsm/worker start`.

ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=10.13.1

FROM node:${NODE_VERSION} AS base
# libc6-compat: same rationale as apps/web/Dockerfile (glibc-only native
# deps some transitive packages may ship prebuilt binaries for).
RUN apk add --no-cache libc6-compat
ARG PNPM_VERSION
# COREPACK_HOME pinned to a fixed, world-readable path: this stage prepares
# pnpm as root, but `runner` (below) runs it as the non-root "worker" user,
# whose $HOME differs from root's - without this, corepack's cache is
# invisible to that user and every container start silently re-downloads
# pnpm from the npm registry (see the matching fix/rationale in
# apps/web/Dockerfile's runner stage).
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate \
  && chmod -R a+rX /opt/corepack
WORKDIR /app

# ---------------------------------------------------------------------------
# deps: install the workspace deps this service needs (cached unless
# manifests or the lockfile change)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# runner: minimal production image, runs straight off TS source via tsx
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 worker

COPY --from=deps --chown=worker:nodejs /app ./
COPY --chown=worker:nodejs apps/worker apps/worker
COPY --chown=worker:nodejs packages/core packages/core
COPY --chown=worker:nodejs packages/db packages/db

USER worker

CMD ["pnpm", "--filter", "@itsm/worker", "start"]
