import { setDefaultResultOrder } from "node:dns";
import "dotenv/config";

// Node's default DNS resolution order can return the IPv6 loopback (::1) first for
// "localhost". In this dev environment that IPv6 address doesn't complete the TCP
// handshake against the dockerized Postgres port mapping and the connection just
// hangs forever (confirmed: `pg` connects instantly against 127.0.0.1, but hangs
// indefinitely against "localhost" with the default resolution order). Forcing
// ipv4first here - once, before any test imports `@itsm/db` - fixes it for every
// integration test without touching DATABASE_URL itself.
setDefaultResultOrder("ipv4first");
