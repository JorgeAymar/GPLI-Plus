import { describe, expect, it } from "vitest";
import { createBudgetSchema } from "./budget.zod";

const VALID_ENTITY_ID = "11111111-1111-1111-1111-111111111111";

describe("createBudgetSchema", () => {
  it("accepts a minimal valid payload (amountCents required, dates/comment optional)", () => {
    const result = createBudgetSchema.parse({ entityId: VALID_ENTITY_ID, name: "FY2026 IT budget", amountCents: 100000 });
    expect(result.startDate).toBeUndefined();
    expect(result.endDate).toBeUndefined();
  });

  it("accepts amountCents of exactly 0 (min boundary is inclusive)", () => {
    expect(createBudgetSchema.safeParse({ entityId: VALID_ENTITY_ID, name: "Zero budget", amountCents: 0 }).success).toBe(
      true,
    );
  });

  it("coerces ISO date strings to Date instances", () => {
    const result = createBudgetSchema.parse({
      entityId: VALID_ENTITY_ID,
      name: "FY2026 IT budget",
      amountCents: 100000,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeInstanceOf(Date);
  });

  it.each([
    ["missing amountCents", { entityId: VALID_ENTITY_ID, name: "x" }],
    ["negative amountCents", { entityId: VALID_ENTITY_ID, name: "x", amountCents: -1 }],
    ["non-integer amountCents", { entityId: VALID_ENTITY_ID, name: "x", amountCents: 99.99 }],
    ["missing name", { entityId: VALID_ENTITY_ID, amountCents: 100 }],
    ["empty name", { entityId: VALID_ENTITY_ID, name: "", amountCents: 100 }],
    ["missing entityId", { name: "x", amountCents: 100 }],
    ["invalid startDate", { entityId: VALID_ENTITY_ID, name: "x", amountCents: 100, startDate: "not-a-date" }],
    ["comment over 2000 chars", { entityId: VALID_ENTITY_ID, name: "x", amountCents: 100, comment: "a".repeat(2001) }],
  ])("rejects %s", (_label, payload) => {
    expect(createBudgetSchema.safeParse(payload).success).toBe(false);
  });
});
