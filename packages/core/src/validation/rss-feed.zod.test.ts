import { describe, expect, it } from "vitest";
import { createRssFeedSchema } from "./rss-feed.zod";

describe("rss-feed.zod createRssFeedSchema", () => {
  const base = { name: "Tech news", ownerUserId: crypto.randomUUID(), url: "https://example.com/feed.xml" };

  it("accepts a minimal valid feed", () => {
    expect(createRssFeedSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an invalid URL string", () => {
    expect(createRssFeedSchema.safeParse({ ...base, url: "not a url" }).success).toBe(false);
  });

  it("rejects maxItems above 100", () => {
    expect(createRssFeedSchema.safeParse({ ...base, maxItems: 101 }).success).toBe(false);
  });

  it("rejects a zero or negative refreshRateMinutes", () => {
    expect(createRssFeedSchema.safeParse({ ...base, refreshRateMinutes: 0 }).success).toBe(false);
    expect(createRssFeedSchema.safeParse({ ...base, refreshRateMinutes: -5 }).success).toBe(false);
  });

  it("rejects a non-uuid ownerUserId", () => {
    expect(createRssFeedSchema.safeParse({ ...base, ownerUserId: "nope" }).success).toBe(false);
  });

  it("note: the zod schema itself does not enforce the anti-SSRF/private-IP rules from isSafeRssUrl", () => {
    // Documents a real gap: this schema is pure shape/URL-format validation. A syntactically valid
    // URL pointing at a private/loopback address (e.g. the cloud metadata endpoint) passes zod fine -
    // the actual SSRF guard only runs later, inside rss-feed-service.ts's refreshRssFeed().
    const result = createRssFeedSchema.safeParse({ ...base, url: "http://169.254.169.254/latest/meta-data/" });
    expect(result.success).toBe(true);
  });
});
