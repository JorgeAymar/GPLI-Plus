import { defineConfig } from "vitest/config";

// Separate config for *.integration.test.ts (see vitest.config.ts, which
// excludes these from the default `pnpm test` run since they require a
// live `npm run dev` server). Used only by `npm run test:mcp-integration`,
// which points vitest at this config explicitly via `-c`.
export default defineConfig({
  test: {},
});
