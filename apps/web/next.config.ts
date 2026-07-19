import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Emit a self-contained `.next/standalone` build (with a minimal server.js
  // and only the node_modules actually required at runtime). This is what
  // the production Dockerfile copies into the final image so it doesn't
  // need to ship the full workspace node_modules tree.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  output: "standalone",

  // @itsm/db and @itsm/core are workspace packages with no build step of
  // their own (their package.json "main"/"exports" point straight at
  // ./src/**.ts). Next.js only transpiles files inside the app by default,
  // so workspace deps like these must be listed here or the build (and the
  // standalone output tracing) will fail to process them.
  transpilePackages: ["@itsm/db", "@itsm/core"],
};

export default withNextIntl(nextConfig);
