import { listActiveRssFeedsForRefresh, refreshRssFeed } from "@itsm/core";
import type { PgBoss } from "pg-boss";

const QUEUE_NAME = "rss-feed-refresh-sweep";
const CRON = process.env.RSS_FEED_REFRESH_CRON ?? "*/15 * * * *"; // every 15 minutes

/**
 * Registers the recurring RSS refresh sweep. v1 simplification (documented in
 * rss-feed-service.ts): listActiveRssFeedsForRefresh() returns every active
 * feed rather than filtering by whether each feed's own refreshRateMinutes
 * has actually elapsed - refreshing a feed early is harmless (its cache is
 * just wholesale-replaced), so this errs toward simplicity for v1.
 *
 * Each feed is refreshed inside its own try/catch: one feed's fetch/parse
 * failure (network error, unsafe URL, bad XML, etc.) must not stop the sweep
 * from refreshing the rest.
 */
export async function registerRssFeedRefreshJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(QUEUE_NAME);
  await boss.schedule(QUEUE_NAME, CRON);

  await boss.work(QUEUE_NAME, async () => {
    const feeds = await listActiveRssFeedsForRefresh();
    let refreshed = 0;
    let failed = 0;

    for (const feed of feeds) {
      try {
        await refreshRssFeed(feed.id);
        refreshed++;
      } catch (err) {
        failed++;
        console.error(`[rss-feed-refresh] feed ${feed.id} (${feed.name}) failed:`, err);
      }
    }

    if (refreshed > 0 || failed > 0) {
      console.log(`[rss-feed-refresh] ${refreshed} feed(s) refreshed, ${failed} failed`);
    }
  });
}
