import { setDefaultResultOrder } from "node:dns";
import path from "node:path";
import dotenv from "dotenv";

// Mirrors packages/core/vitest.setup.ts: Node's default DNS resolution order can return the
// IPv6 loopback (::1) first for "localhost", which doesn't complete the TCP handshake against
// the dockerized Postgres port mapping in this dev environment and just hangs. Forcing
// ipv4first here - once, before any test imports @itsm/db - fixes it for every Jest test too.
setDefaultResultOrder("ipv4first");

// This Jest process runs with its cwd at the repo root (see tests/jest/jest.config.js), so
// dotenv's default `path: ".env"` already resolves correctly - but pin it explicitly since
// jest.setup files can, in some setups, run with a different resolved cwd than expected.
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
