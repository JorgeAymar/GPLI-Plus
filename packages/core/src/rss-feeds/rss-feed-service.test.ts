import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, resourceVisibilityRules, rssFeedCachedItems, rssFeeds, type Entity, type Profile, type User } from "@itsm/db";
import {
  buildAuthContext,
  createTestEntity,
  createTestProfile,
  createTestUser,
  deleteTestEntities,
  deleteTestProfiles,
  deleteTestUsers,
} from "../__vitest_tools__/fixtures";
import { addVisibilityRule } from "../visibility/visibility-service";
import { createRssFeed, getRssFeed, listActiveRssFeedsForRefresh, listCachedItems, listRssFeeds } from "./rss-feed-service";

// The anti-SSRF guard itself (isSafeExternalUrl) is shared with webhook-service.ts
// and tested once in ../url-safety.test.ts, not duplicated here.
describe("rss-feed-service", () => {
  describe("with a real database", () => {
    let owner: User;
    let otherUser: User;
    let profile: Profile;
    let entity: Entity;

    const userIds: string[] = [];
    const profileIds: string[] = [];
    const entityIds: string[] = [];
    const feedIds: string[] = [];

    beforeAll(async () => {
      owner = await createTestUser();
      otherUser = await createTestUser();
      userIds.push(owner.id, otherUser.id);
      profile = await createTestProfile();
      profileIds.push(profile.id);
      entity = await createTestEntity();
      entityIds.push(entity.id);
    });

    afterAll(async () => {
      for (const feedId of feedIds) {
        await db.delete(resourceVisibilityRules).where(eq(resourceVisibilityRules.resourceId, feedId));
        await db.delete(rssFeedCachedItems).where(eq(rssFeedCachedItems.feedId, feedId));
      }
      for (const feedId of feedIds) {
        await db.delete(rssFeeds).where(eq(rssFeeds.id, feedId));
      }
      await deleteTestProfiles(profileIds);
      await deleteTestUsers(userIds);
      await deleteTestEntities(entityIds);
    });

    async function makeFeed(overrides?: Partial<Parameters<typeof createRssFeed>[0]>) {
      const feed = await createRssFeed({
        name: `__vitest_tools__ feed ${crypto.randomUUID().slice(0, 8)}`,
        ownerUserId: owner.id,
        url: "https://example.com/feed.xml",
        ...overrides,
      });
      feedIds.push(feed.id);
      return feed;
    }

    it("createRssFeed + getRssFeed roundtrip, with documented defaults", async () => {
      const feed = await makeFeed();
      const fetched = await getRssFeed(feed.id);
      expect(fetched?.refreshRateMinutes).toBe(1440);
      expect(fetched?.maxItems).toBe(20);
      expect(fetched?.isActive).toBe(true);
    });

    it("a private RSS feed is invisible to another user until explicitly shared, then becomes visible", async () => {
      const feed = await makeFeed();

      const ownerContext = buildAuthContext(owner, entity, profile);
      const otherContext = buildAuthContext(otherUser, entity, profile);

      const ownVisible = await listRssFeeds(ownerContext);
      expect(ownVisible.map((f) => f.id)).toContain(feed.id);

      const beforeShare = await listRssFeeds(otherContext);
      expect(beforeShare.map((f) => f.id)).not.toContain(feed.id);

      await addVisibilityRule({ resourceType: "rss_feed", resourceId: feed.id, granteeKind: "user", granteeId: otherUser.id });

      const afterShare = await listRssFeeds(otherContext);
      expect(afterShare.map((f) => f.id)).toContain(feed.id);
    });

    it("listCachedItems returns a feed's cached items ordered by publishedAt desc", async () => {
      const feed = await makeFeed();
      const older = new Date("2026-01-01T00:00:00Z");
      const newer = new Date("2026-06-01T00:00:00Z");

      await db.insert(rssFeedCachedItems).values({
        feedId: feed.id,
        title: "__vitest_tools__ older item",
        link: "https://example.com/older",
        publishedAt: older,
      });
      await db.insert(rssFeedCachedItems).values({
        feedId: feed.id,
        title: "__vitest_tools__ newer item",
        link: "https://example.com/newer",
        publishedAt: newer,
      });

      const items = await listCachedItems(feed.id);
      expect(items.map((i) => i.title)).toEqual(["__vitest_tools__ newer item", "__vitest_tools__ older item"]);
    });

    it("listActiveRssFeedsForRefresh only returns feeds with isActive=true", async () => {
      const activeFeed = await makeFeed();
      const inactiveFeed = await makeFeed({ name: `__vitest_tools__ inactive ${crypto.randomUUID().slice(0, 8)}` });
      await db.update(rssFeeds).set({ isActive: false }).where(eq(rssFeeds.id, inactiveFeed.id));

      const active = await listActiveRssFeedsForRefresh();
      const ids = active.map((f) => f.id);
      expect(ids).toContain(activeFeed.id);
      expect(ids).not.toContain(inactiveFeed.id);
    });
  });
});
