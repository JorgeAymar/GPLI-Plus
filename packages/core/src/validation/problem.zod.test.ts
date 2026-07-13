import { describe, expect, it } from "vitest";
import { createProblemSchema, updateProblemSchema } from "./problem.zod";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("problem.zod", () => {
  describe("createProblemSchema", () => {
    it("accepts a minimal valid payload", () => {
      expect(createProblemSchema.safeParse({ entityId: validUuid, title: "t", content: "c" }).success).toBe(true);
    });

    it.each(["entityId", "title", "content"] as const)("rejects when %s is missing", (field) => {
      const payload: Record<string, unknown> = { entityId: validUuid, title: "t", content: "c" };
      delete payload[field];
      expect(createProblemSchema.safeParse(payload).success).toBe(false);
    });

    it("rejects urgency/impact/priority outside 1-5", () => {
      expect(createProblemSchema.safeParse({ entityId: validUuid, title: "t", content: "c", impact: 0 }).success).toBe(false);
      expect(createProblemSchema.safeParse({ entityId: validUuid, title: "t", content: "c", priority: 6 }).success).toBe(false);
    });

    it("rejects content longer than 20000 characters", () => {
      const tooLong = "a".repeat(20_001);
      expect(createProblemSchema.safeParse({ entityId: validUuid, title: "t", content: tooLong }).success).toBe(false);
    });
  });

  describe("updateProblemSchema", () => {
    it("has no required fields", () => {
      expect(updateProblemSchema.safeParse({}).success).toBe(true);
    });

    it("still validates provided fields against the base rules", () => {
      expect(updateProblemSchema.safeParse({ urgency: 10 }).success).toBe(false);
      expect(updateProblemSchema.safeParse({ urgency: 4 }).success).toBe(true);
    });
  });
});
