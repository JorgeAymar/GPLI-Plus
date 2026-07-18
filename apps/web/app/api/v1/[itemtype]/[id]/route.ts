import { hasScope, ITEMTYPE_REGISTRY } from "@itsm/core";
import type { ApiClient } from "@itsm/db";
import { NextResponse } from "next/server";
import { authenticateApiRequest } from "../../_lib/authenticate";

/** Public REST API v1 - single-item endpoint, e.g. `GET /api/v1/tickets/<uuid>`. See [itemtype]/route.ts for auth/scope notes. */
export async function GET(req: Request, { params }: { params: Promise<{ itemtype: string; id: string }> }) {
  let client: ApiClient;
  try {
    client = await authenticateApiRequest(req);
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  // /api/v1 is the entity-scoped public REST API - personal (userId-owned)
  // tokens are for the (future) /api/mcp endpoint instead. See api-clients.ts.
  if (!client.entityId) {
    return NextResponse.json(
      { error: "This is a personal access token - it cannot be used against /api/v1. Use it against /api/mcp instead." },
      { status: 401 },
    );
  }

  const { itemtype, id } = await params;
  const entry = ITEMTYPE_REGISTRY[itemtype];
  if (!entry) {
    return NextResponse.json({ error: `Unknown item type "${itemtype}"` }, { status: 404 });
  }

  if (!hasScope(client, entry.moduleKey)) {
    return NextResponse.json({ error: `API client is not scoped for "${entry.moduleKey}"` }, { status: 403 });
  }

  if (!entry.get) {
    return NextResponse.json({ error: `Item type "${itemtype}" does not support single-item lookup` }, { status: 501 });
  }

  const item = await entry.get(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: item });
}
