import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Visibility is resource-based (resourceType="rss_feed") via resource_visibility_rules - see visibility-service.ts, not a column here. */
export const rssFeeds = pgTable("rss_feeds", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  url: text("url").notNull(),
  refreshRateMinutes: integer("refresh_rate_minutes").notNull().default(1440),
  maxItems: integer("max_items").notNull().default(20),
  isActive: boolean("is_active").notNull().default(true),
  // Flipped by rss-feed-service.ts refreshRssFeed() on fetch/parse failure - surfaced in the list UI.
  haveError: boolean("have_error").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Simple wholesale-replace cache (no TTL/diffing, no Redis): refreshRssFeed()
 * deletes every row for a feed and reinserts the freshly fetched+sanitized
 * items each time it runs. See rss-feed-service.ts for the tradeoff note.
 */
export const rssFeedCachedItems = pgTable(
  "rss_feed_cached_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feedId: uuid("feed_id")
      .notNull()
      .references(() => rssFeeds.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    link: text("link").notNull(),
    publishedAt: timestamp("published_at", { mode: "date" }),
    // Pre-sanitized (sanitize-html) at fetch time in rss-feed-service.ts - the web UI still renders
    // this as plain text rather than raw markup, as defense in depth (see tools/rss-feeds/[id]/page.tsx).
    description: text("description"),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("rss_feed_cached_items_feed_idx").on(table.feedId)],
);

export type RssFeed = typeof rssFeeds.$inferSelect;
export type NewRssFeed = typeof rssFeeds.$inferInsert;
export type RssFeedCachedItem = typeof rssFeedCachedItems.$inferSelect;
export type NewRssFeedCachedItem = typeof rssFeedCachedItems.$inferInsert;
