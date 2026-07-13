import { describe, expect, it } from "vitest";
import { addClusterMemberSchema, createCableSchema, placeInEnclosureSchema, placeInRackSchema, rackSlotOrientationSchema } from "./dcim.zod";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const VALID_UUID_2 = "22222222-2222-2222-2222-222222222222";

describe("dcim.zod", () => {
  describe("rackSlotOrientationSchema", () => {
    it("accepts front/rear and rejects anything else", () => {
      expect(rackSlotOrientationSchema.safeParse("front").success).toBe(true);
      expect(rackSlotOrientationSchema.safeParse("rear").success).toBe(true);
      expect(rackSlotOrientationSchema.safeParse("side").success).toBe(false);
    });
  });

  describe("placeInRackSchema", () => {
    const base = { rackAssetId: VALID_UUID, occupantAssetId: VALID_UUID_2, positionU: 1 };

    it("accepts the minimal valid payload, defaulting unitHeight/orientation to be optional", () => {
      expect(placeInRackSchema.safeParse(base).success).toBe(true);
    });

    it("accepts an explicit unitHeight and orientation", () => {
      expect(placeInRackSchema.safeParse({ ...base, unitHeight: 4, orientation: "rear" }).success).toBe(true);
    });

    it("rejects positionU/unitHeight below 1, or a non-integer", () => {
      expect(placeInRackSchema.safeParse({ ...base, positionU: 0 }).success).toBe(false);
      expect(placeInRackSchema.safeParse({ ...base, unitHeight: 0 }).success).toBe(false);
      expect(placeInRackSchema.safeParse({ ...base, positionU: 1.5 }).success).toBe(false);
    });

    it("rejects an invalid orientation", () => {
      expect(placeInRackSchema.safeParse({ ...base, orientation: "side" }).success).toBe(false);
    });
  });

  describe("placeInEnclosureSchema", () => {
    it("accepts the minimal valid payload", () => {
      expect(
        placeInEnclosureSchema.safeParse({ enclosureAssetId: VALID_UUID, occupantAssetId: VALID_UUID_2, positionSlot: 1 }).success,
      ).toBe(true);
    });

    it("rejects positionSlot below 1", () => {
      expect(
        placeInEnclosureSchema.safeParse({ enclosureAssetId: VALID_UUID, occupantAssetId: VALID_UUID_2, positionSlot: 0 }).success,
      ).toBe(false);
    });
  });

  describe("addClusterMemberSchema", () => {
    it("accepts two valid uuids", () => {
      expect(addClusterMemberSchema.safeParse({ clusterAssetId: VALID_UUID, memberAssetId: VALID_UUID_2 }).success).toBe(true);
    });

    it("rejects a non-uuid id", () => {
      expect(addClusterMemberSchema.safeParse({ clusterAssetId: "nope", memberAssetId: VALID_UUID_2 }).success).toBe(false);
    });
  });

  describe("createCableSchema", () => {
    const base = { endpointAAssetId: VALID_UUID, endpointBAssetId: VALID_UUID_2 };

    it("accepts the minimal valid payload", () => {
      expect(createCableSchema.safeParse(base).success).toBe(true);
    });

    it("does not itself reject a cable whose two endpoints are the same asset (no refine on this schema)", () => {
      // Documents current behavior: unlike addImpactRelationSchema, createCableSchema has no
      // `.refine()` guarding against endpointA === endpointB, so this passes at the zod layer.
      const result = createCableSchema.safeParse({ endpointAAssetId: VALID_UUID, endpointBAssetId: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it("rejects a missing endpoint", () => {
      expect(createCableSchema.safeParse({ endpointAAssetId: VALID_UUID }).success).toBe(false);
    });

    it("rejects a comment over 2000 characters", () => {
      expect(createCableSchema.safeParse({ ...base, comment: "x".repeat(2001) }).success).toBe(false);
    });
  });
});
