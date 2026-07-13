import { hasScope, ITEMTYPE_REGISTRY } from "@itsm/core";
import type { ApiClient } from "@itsm/db";
import { NextResponse } from "next/server";
import { authenticateApiRequest } from "../_lib/authenticate";

/**
 * Public REST API v1 - list endpoint for a registered item type, e.g.
 * `GET /api/v1/tickets`. Bearer-token auth only (no session/JWT - see
 * apps/web/proxy.ts's matcher, which already excludes /api/** from the
 * human-session proxy).
 *
 * v1 scope: read-only (GET/list + GET/get in the sibling [id] route).
 * POST/create is intentionally NOT wired here yet: creating e.g. a ticket
 * needs a "requester" actor (see createTicket's requesterUserId param), and
 * there's no obvious human user to attribute that to when the actor is an
 * API client rather than a person - that's a real design decision (service
 * account? actor_kind "api_client"?) better made explicitly in a follow-up
 * pass than guessed at here. ITEMTYPE_REGISTRY's entries reflect this: they
 * only carry `list`/`get`, no `create`.
 */
export async function GET(req: Request, { params }: { params: Promise<{ itemtype: string }> }) {
  let client: ApiClient;
  try {
    client = await authenticateApiRequest(req);
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { itemtype } = await params;
  const entry = ITEMTYPE_REGISTRY[itemtype];
  if (!entry) {
    return NextResponse.json({ error: `Unknown item type "${itemtype}"` }, { status: 404 });
  }

  if (!hasScope(client, entry.moduleKey)) {
    return NextResponse.json({ error: `API client is not scoped for "${entry.moduleKey}"` }, { status: 403 });
  }

  const items = await entry.list(client.entityId);
  return NextResponse.json({ data: items });
}
