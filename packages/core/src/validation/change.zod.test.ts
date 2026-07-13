import { describe, expect, it } from "vitest";
import { createChangeSchema, updateChangeSchema } from "./change.zod";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("change.zod", () => {
  describe("createChangeSchema", () => {
    it("accepts a minimal valid payload", () => {
      expect(createChangeSchema.safeParse({ entityId: validUuid, title: "t", content: "c" }).success).toBe(true);
    });

    it("coerces planned date strings into real Date instances", () => {
      const result = createChangeSchema.safeParse({
        entityId: validUuid,
        title: "t",
        content: "c",
        plannedStartAt: "2026-08-01T10:00:00.000Z",
        plannedEndAt: "2026-08-01T12:00:00.000Z",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plannedStartAt).toBeInstanceOf(Date);
        expect(result.data.plannedEndAt).toBeInstanceOf(Date);
      }
    });

    it("allows planned dates to be explicitly null or omitted", () => {
      expect(
        createChangeSchema.safeParse({ entityId: validUuid, title: "t", content: "c", plannedStartAt: null, plannedEndAt: null })
          .success,
      ).toBe(true);
      expect(createChangeSchema.safeParse({ entityId: validUuid, title: "t", content: "c" }).success).toBe(true);
    });

    it("rejects an unparsable planned date", () => {
      expect(
        createChangeSchema.safeParse({ entityId: validUuid, title: "t", content: "c", plannedStartAt: "not-a-date" }).success,
      ).toBe(false);
    });
  });

  describe("updateChangeSchema", () => {
    it("has no required fields", () => {
      expect(updateChangeSchema.safeParse({}).success).toBe(true);
    });
  });
});
