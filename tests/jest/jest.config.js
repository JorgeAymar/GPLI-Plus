/**
 * Root Jest config for the additive, second test surface described in
 * docs/superpowers/specs/2026-07-19-plan-de-pruebas.md (auth/get-auth-context.ts,
 * rules/rule-engine.ts, and a handful of apps/web/actions/*.ts files with real
 * logic of their own). This is intentionally separate from the project's
 * primary Vitest suite (packages/core, apps/web `*.test.ts`) - see the repo's
 * root README testing section for why Jest lives alongside Vitest here rather
 * than replacing/merging with it.
 *
 * Runs against the SAME real dev Postgres the Vitest suite uses (no DB mocks,
 * matching this project's documented no-mocks convention) - only Next.js
 * request-scoped primitives that have no meaning outside an actual Next.js
 * request (next/cache's revalidatePath, the session-resolution wrapper in
 * apps/web/lib/session.ts, apps/web/lib/auth.ts's unstable_update) are
 * mocked per-test, because a plain Jest/Node process has no HTTP request to
 * hang them off. Every DB read/write reachable from those actions still goes
 * through the real services and the real Postgres instance.
 *
 * Tests live under tests/jest/ (not colocated with packages/core/src or
 * apps/web) specifically so this config's testMatch never overlaps with
 * Vitest's default include glob in packages/core/vitest.config.ts and
 * apps/web/vitest.config.ts - the 690 existing Vitest tests must stay
 * completely unaffected by this addition.
 */

/** @type {import('jest').Config} */
module.exports = {
  rootDir: "../..",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/jest/**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/jest/jest.setup.ts"],
  transform: {
    // Matches both .ts(x) and .js(x): a couple of core's transitive dependencies
    // (e.g. htmlparser2, pulled in via sanitize-html <- rss-feed-service.ts <- the
    // @itsm/core barrel) ship ESM-only JS in node_modules, which Jest's default CJS
    // require() can't load. ts-jest (tsconfig "allowJs": true) transpiles those too
    // instead of only the project's own .ts sources.
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tests/jest/tsconfig.json",
      },
    ],
  },
  // Don't skip node_modules - see the transform comment above for why.
  transformIgnorePatterns: [],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  moduleNameMapper: {
    // Resolve the two workspace packages straight to their TS source, bypassing the
    // pnpm-symlinked node_modules/@itsm/* entries entirely - keeps resolution deterministic
    // regardless of how Jest's resolver happens to treat those symlinks.
    "^@itsm/db$": "<rootDir>/packages/db/src/client.ts",
    "^@itsm/db/schema$": "<rootDir>/packages/db/src/schema/index.ts",
    "^@itsm/core$": "<rootDir>/packages/core/src/index.ts",
    // Mirrors apps/web/tsconfig.json's "@/*" -> "./*" path alias.
    "^@/(.*)$": "<rootDir>/apps/web/$1",
  },
  // Real Postgres, shared across test files, same reasoning as
  // packages/core/vitest.config.ts's fileParallelism:false - several fixtures here touch
  // global (non-entity-scoped) tables, so keep files sequential rather than racing them
  // across worker processes.
  maxWorkers: 1,
  testTimeout: 20_000,
};
