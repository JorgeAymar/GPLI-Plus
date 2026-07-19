import { ITEMTYPE_REGISTRY, RIGHT, requireRight, resolveAuthContext, verifyApiKey } from "@itsm/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

/**
 * Remote MCP server endpoint - read-only tools generated from
 * ITEMTYPE_REGISTRY (packages/core/src/api-clients/itemtype-registry.ts),
 * one list_<key>/get_<key> pair per registered item type. Adding an entry to
 * that registry makes it show up here automatically - no tool is hardcoded
 * per item type.
 *
 * Auth: a personal access token (api_clients.userId set - see
 * packages/core/src/api-clients/api-client-service.ts::createPersonalApiClient).
 * An entity-level token (the /api/v1 kind) is explicitly rejected - the two
 * token kinds are not interchangeable.
 *
 * Stateless: no sessionIdGenerator, since every tool call re-resolves the
 * caller's AuthContext fresh (matching how a page render or Server Action
 * already does) - there is no server-held state to preserve between calls.
 *
 * Known limitation inherited from /api/v1/[itemtype]/[id]/route.ts: `get_<key>`
 * looks up by id without verifying the item's entity is within the caller's
 * entity subtree (the registry's `get?(id)` signature has no entityId
 * parameter to check against). Same gap as the existing public REST API,
 * not introduced here - flagged so a future fix covers both call sites.
 */

function buildServer(userId: string): McpServer {
  const server = new McpServer({ name: "itsm-platform", version: "1.0.0" });

  for (const [key, entry] of Object.entries(ITEMTYPE_REGISTRY)) {
    server.registerTool(`list_${key}`, { description: `Lista los "${key}" de tu entidad activa (incluye subárbol).` }, async () => {
      const context = await resolveAuthContext({ userId, activeEntityId: null, activeProfileId: null });
      if (!context) {
        return { content: [{ type: "text" as const, text: "Tu usuario ya no está activo." }], isError: true };
      }
      try {
        await requireRight(context, entry.moduleKey, RIGHT.READ);
      } catch (err) {
        return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : "Sin permiso" }], isError: true };
      }
      const items = await entry.list(context.activeEntity.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(items) }] };
    });

    if (entry.get) {
      const get = entry.get;
      server.registerTool(
        `get_${key}`,
        {
          description: `Obtiene un "${key.replace(/s$/, "")}" por id.`,
          inputSchema: { id: z.string().uuid() },
        },
        async ({ id }) => {
          const context = await resolveAuthContext({ userId, activeEntityId: null, activeProfileId: null });
          if (!context) {
            return { content: [{ type: "text" as const, text: "Tu usuario ya no está activo." }], isError: true };
          }
          try {
            await requireRight(context, entry.moduleKey, RIGHT.READ);
          } catch (err) {
            return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : "Sin permiso" }], isError: true };
          }
          const item = await get(id);
          if (!item) {
            return { content: [{ type: "text" as const, text: `No se encontró "${key}" con id ${id}.` }], isError: true };
          }
          return { content: [{ type: "text" as const, text: JSON.stringify(item) }] };
        },
      );
    }
  }

  return server;
}

async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("authorization") ?? "";
  const [scheme, rawKey] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !rawKey) {
    return Response.json({ error: "Missing or malformed Authorization header. Expected: Bearer <token>" }, { status: 401 });
  }

  const client = await verifyApiKey(rawKey);
  if (!client) {
    return Response.json({ error: "Invalid or revoked token" }, { status: 401 });
  }
  if (!client.userId) {
    return Response.json(
      { error: "Este token es de entidad, no personal. Los tokens MCP se crean desde /account." },
      { status: 401 },
    );
  }
  return { userId: client.userId };
}

async function handleMcpRequest(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  const server = buildServer(authResult.userId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function GET(req: Request) {
  return handleMcpRequest(req);
}

export async function POST(req: Request) {
  return handleMcpRequest(req);
}

export async function DELETE(req: Request) {
  return handleMcpRequest(req);
}
