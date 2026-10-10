// Docker/Swarm secrets: for every VAR_FILE env var, load the file contents into VAR
// (unless VAR is already set). Must be the FIRST import of index.ts so that modules
// that read process.env at import time already see the values.
import { readFileSync } from "node:fs";

for (const [key, path] of Object.entries(process.env)) {
  if (!key.endsWith("_FILE") || !path) continue;
  const target = key.slice(0, -"_FILE".length);
  if (process.env[target]) continue;
  process.env[target] = readFileSync(path, "utf8").trim();
}
