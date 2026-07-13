import { describe, expect, it } from "vitest";
import { createSavedSearchAlertSchema, createSavedSearchSchema } from "./saved-search.zod";

describe("saved-search.zod", () => {
  describe("createSavedSearchSchema", () => {
    const base = { name: "Open tickets", itemType: "ticket", ownerUserId: crypto.randomUUID(), entityId: crypto.randomUUID() };

    it("accepts a minimal valid saved search", () => {
      expect(createSavedSearchSchema.safeParse(base).success).toBe(true);
    });

    it("accepts an arbitrary queryJson blob (opaque, no generic search-engine shape enforced)", () => {
      const result = createSavedSearchSchema.safeParse({ ...base, queryJson: { anything: ["goes"], nested: { ok: true } } });
      expect(result.success).toBe(true);
    });

    it("rejects an unknown 'type' enum value", () => {
      const result = createSavedSearchSchema.safeParse({ ...base, type: "not-a-real-type" });
      expect(result.success).toBe(false);
    });

    it("rejects a missing itemType", () => {
      const { itemType, ...withoutItemType } = base;
      void itemType;
      expect(createSavedSearchSchema.safeParse(withoutItemType).success).toBe(false);
    });
  });

  describe("createSavedSearchAlertSchema", () => {
    const base = { savedSearchId: crypto.randomUUID(), operator: "gte" as const, thresholdValue: 10 };

    it("accepts a minimal valid alert", () => {
      expect(createSavedSearchAlertSchema.safeParse(base).success).toBe(true);
    });

    it("rejects an invalid operator", () => {
      expect(createSavedSearchAlertSchema.safeParse({ ...base, operator: "startswith" }).success).toBe(false);
    });

    it("rejects a non-integer thresholdValue", () => {
      expect(createSavedSearchAlertSchema.safeParse({ ...base, thresholdValue: 1.5 }).success).toBe(false);
    });

    it("rejects a non-positive frequencyMinutes", () => {
      expect(createSavedSearchAlertSchema.safeParse({ ...base, frequencyMinutes: 0 }).success).toBe(false);
    });
  });
});
