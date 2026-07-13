import { describe, expect, it } from "vitest";
import { addDashboardCardSchema, createDashboardSchema } from "./dashboard.zod";

describe("dashboard.zod", () => {
  describe("createDashboardSchema", () => {
    it("accepts a minimal valid dashboard", () => {
      expect(createDashboardSchema.safeParse({ key: "sales_overview", name: "Sales overview" }).success).toBe(true);
    });

    it("rejects a key longer than 100 characters", () => {
      expect(createDashboardSchema.safeParse({ key: "a".repeat(101), name: "x" }).success).toBe(false);
    });

    it("rejects an empty name", () => {
      expect(createDashboardSchema.safeParse({ key: "k", name: "" }).success).toBe(false);
    });
  });

  describe("addDashboardCardSchema", () => {
    it("accepts a minimal valid card", () => {
      expect(addDashboardCardSchema.safeParse({ dashboardId: crypto.randomUUID(), cardKey: "assets_by_status" }).success).toBe(true);
    });

    it("rejects a non-uuid dashboardId", () => {
      expect(addDashboardCardSchema.safeParse({ dashboardId: "nope", cardKey: "assets_by_status" }).success).toBe(false);
    });

    it("rejects an empty cardKey", () => {
      expect(addDashboardCardSchema.safeParse({ dashboardId: crypto.randomUUID(), cardKey: "" }).success).toBe(false);
    });

    it("note: cardKey is not validated against CardKey/AVAILABLE_CARD_KEYS at the zod layer", () => {
      // Any non-empty string passes this schema - the actual whitelist enforcement (unknown keys
      // resolve to null instead of throwing) lives in card-provider.ts's isCardKey()/resolveCardData().
      const result = addDashboardCardSchema.safeParse({ dashboardId: crypto.randomUUID(), cardKey: "not_a_real_card_key" });
      expect(result.success).toBe(true);
    });
  });
});
