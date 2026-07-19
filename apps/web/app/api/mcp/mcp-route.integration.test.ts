import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApiClient, createPersonalApiClient, findUserByEmail } from "@itsm/core";
import { apiClients, db } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3210";
const PREFIX = "__vitest_mcp_route__";

/**
 * Tokens are created directly through @itsm/core/@itsm/db rather than by
 * logging in and clicking through /account: a Next.js Server Action isn't
 * callable from outside a browser without reimplementing its undocumented
 * internal wire protocol, and this test's job is exercising the /api/mcp
 * HTTP endpoint itself - test setup doesn't need to go through the UI for
 * that. Every actual assertion below still goes over real HTTP/MCP protocol.
 */
describe("MCP route integration (requires `npm run dev` running)", () => {
  let personalRawKey: string;
  let entityRawKey: string;
  const createdClientIds: string[] = [];

  beforeAll(async () => {
    const admin = await findUserByEmail(process.env.E2E_ADMIN_EMAIL ?? "admin@itsm.local");
    if (!admin) throw new Error("Seed the DB first: pnpm db:migrate && cd packages/core && npx tsx scripts/seed.ts");
    if (!admin.defaultEntityId) throw new Error("Seeded admin has no defaultEntityId - re-run packages/core/scripts/seed.ts");

    const personal = await createPersonalApiClient({ userId: admin.id, name: `${PREFIX}_personal` });
    personalRawKey = personal.rawKey;
    createdClientIds.push(personal.client.id);

    // An entity-level token, to confirm the MCP endpoint rejects it (see authenticate() in route.ts).
    const entity = await createApiClient({ entityId: admin.defaultEntityId, name: `${PREFIX}_entity`, scopes: ["assistance.ticket"] });
    entityRawKey = entity.rawKey;
    createdClientIds.push(entity.client.id);
  });

  afterAll(async () => {
    for (const id of createdClientIds) {
      await db.delete(apiClients).where(eq(apiClients.id, id));
    }
  });

  it("rejects a request with no Authorization header", async () => {
    const res = await fetch(`${BASE_URL}/api/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(401);
  });

  it("rejects an entity-level (non-personal) token", async () => {
    const res = await fetch(`${BASE_URL}/api/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${entityRawKey}` },
      body: "{}",
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/entidad, no personal/);
  });

  it("rejects a personal (non-entity) token on the entity-only /api/v1 REST API - the symmetric check", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/tickets`, {
      headers: { authorization: `Bearer ${personalRawKey}` },
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/personal access token/);
  });

  it("lists tools and successfully calls list_tickets with a valid personal token", async () => {
    const client = new Client({ name: "vitest-mcp-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${BASE_URL}/api/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${personalRawKey}` } },
    });
    try {
      await client.connect(transport);

      const { tools } = await client.listTools();
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain("list_tickets");
      expect(toolNames).toContain("get_tickets");
      expect(toolNames).toContain("list_assets");
      expect(toolNames).toContain("list_computers");
      expect(toolNames).toContain("list_problems");
      expect(toolNames).toContain("list_changes");
      expect(toolNames.length).toBe(10); // 5 itemtypes x (list + get), all 5 have `get`

      const result = await client.callTool({ name: "list_tickets", arguments: {} });
      expect(result.isError).not.toBe(true);
      const text = (result.content as Array<{ type: string; text?: string }>)[0]?.text ?? "[]";
      const parsed: unknown = JSON.parse(text);
      expect(Array.isArray(parsed)).toBe(true);
    } finally {
      await client.close();
    }
  });
});
