"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createRssFeed, createRssFeedSchema, requireRight } from "@itsm/core";
import type { RssFeed } from "@itsm/db";
import { revalidatePath } from "next/cache";

export interface CreateRssFeedResult {
  feed?: RssFeed;
  error?: string;
}

/**
 * Returns `{error}` instead of throwing on a validation/SSRF-guard failure -
 * Next.js redacts anything a Server Action *throws* across the client/server
 * boundary in production builds, replacing it with a generic "an error
 * occurred" message regardless of how safe the original message was. See
 * apps/web/actions/users.actions.ts's createUserAction for the same fix
 * with the full explanation.
 */
export async function createRssFeedAction(input: unknown): Promise<CreateRssFeedResult> {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_RSS_FEED, RIGHT.CREATE);

  const parsed = createRssFeedSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues.map((issue) => issue.message).join("; ") };

  let feed: RssFeed;
  try {
    feed = await createRssFeed(parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear el feed." };
  }

  revalidatePath("/tools/rss-feeds");
  return { feed };
}
