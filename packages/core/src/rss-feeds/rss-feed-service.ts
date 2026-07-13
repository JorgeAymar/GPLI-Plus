import { desc, eq } from "drizzle-orm";
import { db, rssFeedCachedItems, rssFeeds, type RssFeed, type RssFeedCachedItem } from "@itsm/db";
import Parser from "rss-parser";
import sanitizeHtml from "sanitize-html";
import type { AuthContext } from "../auth/get-auth-context";
import { isResourceVisibleTo } from "../visibility/visibility-service";

export async function createRssFeed(input: {
  name: string;
  ownerUserId: string;
  url: string;
  refreshRateMinutes?: number;
  maxItems?: number;
}): Promise<RssFeed> {
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

const PRIVATE_IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Anti-SSRF guard (this is the actual reason this function exists): RSS feed
 * URLs are user-supplied and then fetched server-side by refreshRssFeed(),
 * so without this check a feed could be pointed at cloud-metadata endpoints,
 * internal services, or loopback addresses. Rejects non-http(s) schemes and
 * common private/loopback/link-local hostnames/ranges. Not exhaustive
 * DNS-rebinding protection, but stops the obvious cases with plain parsing -
 * no extra dependency needed for this.
 */
export function isSafeRssUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") return false;

  const ipv4Match = hostname.match(PRIVATE_IPV4_PATTERN);
  if (ipv4Match) {
    const first = Number(ipv4Match[1]);
    const second = Number(ipv4Match[2]);
    if (first === 10) return false; // 10.0.0.0/8
    if (first === 127) return false; // 127.0.0.0/8 loopback
    if (first === 169 && second === 254) return false; // 169.254.0.0/16 link-local
    if (first === 172 && second >= 16 && second <= 31) return false; // 172.16.0.0/12
    if (first === 192 && second === 168) return false; // 192.168.0.0/16
  }

  return true;
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

  if (!isSafeRssUrl(feed.url)) {
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
