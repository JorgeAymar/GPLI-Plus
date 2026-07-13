import { verifyApiKey } from "@itsm/core";
import type { ApiClient } from "@itsm/db";
import { NextResponse } from "next/server";

/**
 * Shared by both /api/v1/[itemtype]/route.ts and /api/v1/[itemtype]/[id]/route.ts.
 * Lives in a `_lib` (underscore) folder so Next.js excludes it from routing -
 * see https://nextjs.org/docs private folders convention.
 *
 * Reads `Authorization: Bearer <rawKey>` and resolves it to an ApiClient via
 * verifyApiKey(). On any failure it THROWS the 401 Response itself (not an
 * Error) - callers must catch and return it directly:
 *
 *   let client: ApiClient;
 *   try {
 *     client = await authenticateApiRequest(req);
 *   } catch (res) {
 *     if (res instanceof Response) return res;
 *     throw res;
 *   }
 */
export async function authenticateApiRequest(req: Request): Promise<ApiClient> {
  const authHeader = req.headers.get("authorization") ?? "";
  const [scheme, rawKey] = authHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !rawKey) {
    throw NextResponse.json({ error: "Missing or malformed Authorization header. Expected: Bearer <api_key>" }, { status: 401 });
  }

  const client = await verifyApiKey(rawKey);
  if (!client) {
    throw NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  return client;
}
