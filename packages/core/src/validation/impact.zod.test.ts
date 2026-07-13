import { describe, expect, it } from "vitest";
import { addImpactRelationSchema } from "./impact.zod";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const VALID_UUID_2 = "22222222-2222-2222-2222-222222222222";

describe("impact.zod: addImpactRelationSchema", () => {
  it("accepts a valid relation between two different assets, with or without a label", () => {
    expect(addImpactRelationSchema.safeParse({ sourceAssetId: VALID_UUID, impactedAssetId: VALID_UUID_2 }).success).toBe(true);
    expect(
      addImpactRelationSchema.safeParse({ sourceAssetId: VALID_UUID, impactedAssetId: VALID_UUID_2, label: "depends on" }).success,
    ).toBe(true);
  });

  it("rejects an asset depending on itself (sourceAssetId === impactedAssetId)", () => {
    const result = addImpactRelationSchema.safeParse({ sourceAssetId: VALID_UUID, impactedAssetId: VALID_UUID });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["impactedAssetId"]);
    }
  });

  it("rejects invalid uuids", () => {
    expect(addImpactRelationSchema.safeParse({ sourceAssetId: "nope", impactedAssetId: VALID_UUID_2 }).success).toBe(false);
  });

  it("rejects a label over 255 characters", () => {
    const result = addImpactRelationSchema.safeParse({
      sourceAssetId: VALID_UUID,
      impactedAssetId: VALID_UUID_2,
      label: "x".repeat(256),
    });
    expect(result.success).toBe(false);
  });
});
