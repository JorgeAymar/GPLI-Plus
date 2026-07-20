import { desc, eq } from "drizzle-orm";
import { db, rssFeedCachedItems, rssFeeds, type RssFeed, type RssFeedCachedItem } from "@itsm/db";
import Parser from "rss-parser";
import sanitizeHtml from "sanitize-html";
import type { AuthContext } from "../auth/get-auth-context";
import { isSafeExternalUrl } from "../url-safety";
import { isResourceVisibleTo } from "../visibility/visibility-service";

export async function createRssFeed(input: {
  name: string;
  ownerUserId: string;
  url: string;
  refreshRateMinutes?: number;
  maxItems?: number;
}): Promise<RssFeed> {
  // Checked here too (not just in refreshRssFeed) so an unsafe URL is
  // rejected immediately at creation instead of silently failing on the
  // next scheduled refresh - the zod schema layer only validates URL
  // *shape*, not safety (see validation/rss-feed.zod.test.ts).
  if (!isSafeExternalUrl(input.url)) throw new Error("La URL del feed no es válida o apunta a una dirección no permitida.");

  const [created] = await db
    .insert(rssFeeds)
    .values({
      name: input.name,
      ownerUserId: input.ownerUserId,
      url: input.url,
      refreshRateMinutes: input.refreshRateMinutes ?? 1440,
      maxItems: input.maxItems ?? 20,
    })
    .returning();
  if (!created) throw new Error("Failed to insert RSS feed");
  return created;
}

export async function getRssFeed(id: string): Promise<RssFeed | undefined> {
  const [feed] = await db.select().from(rssFeeds).where(eq(rssFeeds.id, id));
  return feed;
}

/** Same per-row visibility pattern as listKbArticles (kb-service.ts): candidates first, filtered through the shared visibility-service instead of a bespoke join. */
export async function listRssFeeds(context: AuthContext): Promise<RssFeed[]> {
  const candidates = await db.select().from(rssFeeds).orderBy(rssFeeds.name);
  const visible: RssFeed[] = [];
  for (const feed of candidates) {
    if (await isResourceVisibleTo("rss_feed", feed.id, feed.ownerUserId, context)) {
      visible.push(feed);
    }
  }
  return visible;
}

export async function listCachedItems(feedId: string): Promise<RssFeedCachedItem[]> {
  return db
    .select()
    .from(rssFeedCachedItems)
    .where(eq(rssFeedCachedItems.feedId, feedId))
    .orderBy(desc(rssFeedCachedItems.publishedAt));
}

const ALLOWED_DESCRIPTION_TAGS = ["b", "i", "em", "strong", "a", "p", "br"];

/**
 * Replaces the feed's cached items wholesale (a simple TTL-less cache instead
 * of diffing/upserting individual items or standing up Redis - documented
 * simplification for v1). Marks rssFeeds.haveError on any failure (unsafe
 * URL, network, parse) and clears it on success, so the list UI can surface
 * "this feed is broken" without a separate health-check job.
 */
export async function refreshRssFeed(feedId: string): Promise<{ fetched: number }> {
  const feed = await getRssFeed(feedId);
  if (!feed) throw new Error(`RSS feed ${feedId} not found`);

  if (!isSafeExternalUrl(feed.url)) {
    await db.update(rssFeeds).set({ haveError: true, updatedAt: new Date() }).where(eq(rssFeeds.id, feedId));
    throw new Error(`RSS feed ${feedId} has an unsafe URL: ${feed.url}`);
  }

  try {
    const parser = new Parser();
    const parsed = await parser.parseURL(feed.url);
    const items = (parsed.items ?? []).slice(0, feed.maxItems);

    await db.transaction(async (tx) => {
      await tx.delete(rssFeedCachedItems).where(eq(rssFeedCachedItems.feedId, feedId));

      for (const item of items) {
        if (!item.title || !item.link) continue;
        const rawDescription = item.contentSnippet ?? item.content ?? null;
        const description = rawDescription
          ? sanitizeHtml(rawDescription, { allowedTags: ALLOWED_DESCRIPTION_TAGS, allowedAttributes: { a: ["href"] } })
          : null;

        await tx.insert(rssFeedCachedItems).values({
          feedId,
          title: item.title,
          link: item.link,
          publishedAt: item.pubDate ? new Date(item.pubDate) : null,
          description,
        });
      }
    });

    await db.update(rssFeeds).set({ haveError: false, updatedAt: new Date() }).where(eq(rssFeeds.id, feedId));
    return { fetched: items.length };
  } catch (err) {
    await db.update(rssFeeds).set({ haveError: true, updatedAt: new Date() }).where(eq(rssFeeds.id, feedId));
    throw err;
  }
}

/**
 * v1 simplification: returns every active feed rather than filtering by
 * whether each feed's own refreshRateMinutes has actually elapsed since its
 * last fetch. The sweep job itself runs every 15 minutes (see
 * apps/worker/src/jobs/rss-feed-refresh.ts), so a feed configured for e.g.
 * 1440 minutes just ends up refreshed more often than strictly necessary.
 * A follow-up could join against MAX(fetchedAt) per feed and skip ones not
 * yet due.
 */
export async function listActiveRssFeedsForRefresh(): Promise<RssFeed[]> {
  return db.select().from(rssFeeds).where(eq(rssFeeds.isActive, true));
}
