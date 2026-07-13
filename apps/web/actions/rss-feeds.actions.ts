"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createRssFeed, createRssFeedSchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createRssFeedAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_RSS_FEED, RIGHT.CREATE);
  const parsed = createRssFeedSchema.parse(input);
  const feed = await createRssFeed(parsed);
  revalidatePath("/tools/rss-feeds");
  return feed;
}
