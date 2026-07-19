import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // *.integration.test.ts requires a live `npm run dev` server on :3210 (see
    // mcp-route.integration.test.ts) - excluded from the default glob so
    // `pnpm test`/`turbo run test` stay deterministic and don't depend on
    // external process state. Run it explicitly via `npm run test:mcp-integration`.
    // Spreading vitest's own configDefaults.exclude (not replacing it) keeps
    // its standard node_modules/.next/dist/etc. exclusions intact.
    exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
  },
});
