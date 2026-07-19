# syntax=docker/dockerfile:1
#
# Production image for apps/web (ITSM platform), built from the pnpm +
# Turborepo monorepo root as the build context:
#
#   docker build -f apps/web/Dockerfile -t itsm-web .
#
# Designed for on-premise installs (one image per client, run via
# docker-compose against the client's own Postgres instance) rather than a
# centrally hosted SaaS deployment.
#
# Stages:
#   base     - Node + pnpm (corepack), shared by every other stage.
#   deps     - installs the full workspace's node_modules (cached layer,
#              invalidated only when lockfile/package.json files change).
#   builder  - copies the full source and runs `next build` for @itsm/web,
#              producing the standalone output (see next.config.ts).
#   migrator - isolated install of just @itsm/db (+ drizzle-kit, a devDep)
#              in its own directory, used only to run migrations at
#              container startup. Kept separate from the app's node_modules
#              so the Next.js runtime stays on its lean, traced-only tree.
#   runner   - final minimal image: standalone Next.js server + the
#              migrator, non-root user, healthcheck.

ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=10.13.1

FROM node:${NODE_VERSION} AS base
# libc6-compat is the standard Next.js-on-alpine recommendation (glibc-only
# native deps some transitive packages may ship prebuilt binaries for).
RUN apk add --no-cache libc6-compat
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# deps: install the whole workspace's dependencies (cached unless manifests
# or the lockfile change)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder: full source + `next build` (output: "standalone")
# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# `next build`'s "Collecting page data" step imports every route module,
# including dynamic API routes that transitively import @itsm/db
# (packages/db/src/client.ts throws synchronously if DATABASE_URL is unset -
# it never needs to actually connect at build time, just be non-empty).
# A Docker `ENV DATABASE_URL=...` is NOT enough: that step runs inside
# Next's own build-worker subprocesses, which only pick up env vars from
# Next's file-based .env loading, not inherited process env. This file is
# local to the `builder` stage only - the `runner` stage below copies just
# `.next/standalone`, `.next/static`, and `public/`, so this placeholder
# never reaches the shipped image (verified: `docker run ... find /app
# -iname ".env*"` on the built runner image finds nothing).
RUN echo "DATABASE_URL=postgres://build:build@127.0.0.1:5432/build_placeholder" > apps/web/.env.production.local
RUN pnpm exec turbo run build --filter=@itsm/web...

# ---------------------------------------------------------------------------
# migrator: isolated @itsm/db install (incl. its drizzle-kit devDependency)
# used only to run `drizzle-kit migrate` from the entrypoint. Lives in its
# own /migrator tree so it never mixes with the app's traced node_modules.
# ---------------------------------------------------------------------------
FROM base AS migrator
WORKDIR /migrator
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db packages/db
# No --prod flag and no NODE_ENV=production here: we need @itsm/db's
# devDependencies too (drizzle-kit is what actually runs `migrate`).
RUN pnpm install --filter @itsm/db --frozen-lockfile

# ---------------------------------------------------------------------------
# runner: minimal production image
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache libc6-compat
ARG PNPM_VERSION
# pnpm is needed at *runtime* too: the entrypoint shells out to
# `pnpm --filter @itsm/db migrate` before starting the server. That runs as
# the non-root "nextjs" user (set below), whose $HOME differs from the root
# user this RUN executes as - corepack's default cache path is under $HOME,
# so without COREPACK_HOME pinned to a fixed, world-readable location, the
# non-root user can't see what was just prepared here and silently
# re-downloads pnpm from the npm registry on every single container start.
# For an on-premise product that may run at client sites with no/limited
# internet access, that's a live deploy-time dependency worth avoiding.
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate \
  && chmod -R a+rX /opt/corepack

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone Next.js server (traced node_modules + apps/web/server.js).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Static assets & public files are not included in standalone tracing and
# must be copied in manually (see Next.js docs on output: "standalone").
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Migration companion (packages/db source, migrations/, drizzle-kit).
COPY --from=migrator --chown=nextjs:nodejs /migrator ./migrator

COPY --chown=nextjs:nodejs apps/web/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/api/health'},(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
