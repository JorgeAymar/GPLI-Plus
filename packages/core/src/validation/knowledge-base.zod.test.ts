import { describe, expect, it } from "vitest";
import { createKbArticleSchema, createKbCategorySchema, createKbCommentSchema } from "./knowledge-base.zod";

describe("knowledge-base.zod", () => {
  describe("createKbArticleSchema", () => {
    const base = {
      entityId: crypto.randomUUID(),
      title: "How to reset a password",
      body: "Step 1...",
      authorUserId: crypto.randomUUID(),
    };

    it("accepts a minimal valid article", () => {
      expect(createKbArticleSchema.safeParse(base).success).toBe(true);
    });

    it("rejects an empty title", () => {
      expect(createKbArticleSchema.safeParse({ ...base, title: "" }).success).toBe(false);
    });

    it("rejects an empty body", () => {
      expect(createKbArticleSchema.safeParse({ ...base, body: "" }).success).toBe(false);
    });

    it("rejects a title longer than 255 characters", () => {
      expect(createKbArticleSchema.safeParse({ ...base, title: "a".repeat(256) }).success).toBe(false);
    });

    it("rejects a non-uuid authorUserId", () => {
      expect(createKbArticleSchema.safeParse({ ...base, authorUserId: "nope" }).success).toBe(false);
    });

    it("accepts an explicit null beginDate/endDate", () => {
      expect(createKbArticleSchema.safeParse({ ...base, beginDate: null, endDate: null }).success).toBe(true);
    });
  });

  describe("createKbCategorySchema", () => {
    it("accepts a bare name", () => {
      expect(createKbCategorySchema.safeParse({ name: "General" }).success).toBe(true);
    });

    it("rejects a missing name", () => {
      expect(createKbCategorySchema.safeParse({}).success).toBe(false);
    });
  });

  describe("createKbCommentSchema", () => {
    it("rejects content longer than 5000 characters", () => {
      const result = createKbCommentSchema.safeParse({ articleId: crypto.randomUUID(), content: "a".repeat(5001) });
      expect(result.success).toBe(false);
    });

    it("accepts a reply with a parentCommentId", () => {
      const result = createKbCommentSchema.safeParse({
        articleId: crypto.randomUUID(),
        parentCommentId: crypto.randomUUID(),
        content: "thanks!",
      });
      expect(result.success).toBe(true);
    });
  });
});
