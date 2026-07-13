import { describe, expect, it } from "vitest";
import {
  addActorSchema,
  addCostSchema,
  addTimelineItemSchema,
  addValidationSchema,
  itilTypeSchema,
  respondToValidationSchema,
} from "./itil-shared.zod";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("itil-shared.zod", () => {
  it("itilTypeSchema only accepts ticket/problem/change", () => {
    expect(itilTypeSchema.safeParse("ticket").success).toBe(true);
    expect(itilTypeSchema.safeParse("problem").success).toBe(true);
    expect(itilTypeSchema.safeParse("change").success).toBe(true);
    expect(itilTypeSchema.safeParse("asset").success).toBe(false);
  });

  it("addActorSchema validates role/kind enums", () => {
    expect(
      addActorSchema.safeParse({ itilType: "ticket", itilId: validUuid, actorRole: "assignee", actorKind: "group", actorId: validUuid })
        .success,
    ).toBe(true);
    expect(
      addActorSchema.safeParse({ itilType: "ticket", itilId: validUuid, actorRole: "owner", actorKind: "user", actorId: validUuid })
        .success,
    ).toBe(false);
  });

  it("addTimelineItemSchema requires non-empty content and validates itemType", () => {
    expect(
      addTimelineItemSchema.safeParse({ itilType: "ticket", itilId: validUuid, itemType: "followup", content: "hi" }).success,
    ).toBe(true);
    expect(
      addTimelineItemSchema.safeParse({ itilType: "ticket", itilId: validUuid, itemType: "followup", content: "" }).success,
    ).toBe(false);
    expect(
      addTimelineItemSchema.safeParse({ itilType: "ticket", itilId: validUuid, itemType: "unknown_type", content: "hi" }).success,
    ).toBe(false);
  });

  it("addValidationSchema validates validatorKind and allows a nullable comment", () => {
    expect(
      addValidationSchema.safeParse({ itilType: "change", itilId: validUuid, validatorKind: "group", validatorId: validUuid, comment: null })
        .success,
    ).toBe(true);
  });

  it("respondToValidationSchema only accepts approved/refused (not waiting)", () => {
    expect(respondToValidationSchema.safeParse({ status: "approved" }).success).toBe(true);
    expect(respondToValidationSchema.safeParse({ status: "refused" }).success).toBe(true);
    expect(respondToValidationSchema.safeParse({ status: "waiting" }).success).toBe(false);
  });

  it("addCostSchema requires a non-negative integer amountCents", () => {
    expect(addCostSchema.safeParse({ itilType: "ticket", itilId: validUuid, costType: "labor", amountCents: 0 }).success).toBe(true);
    expect(addCostSchema.safeParse({ itilType: "ticket", itilId: validUuid, costType: "labor", amountCents: -1 }).success).toBe(false);
    expect(addCostSchema.safeParse({ itilType: "ticket", itilId: validUuid, costType: "labor", amountCents: 1.5 }).success).toBe(false);
  });
});
