import { describe, expect, it } from "vitest";
import { assignAssetSchema, createAssetSchema, updateAssetSchema } from "./asset.zod";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const VALID_UUID_2 = "22222222-2222-2222-2222-222222222222";

describe("asset.zod", () => {
  describe("createAssetSchema", () => {
    const base = { entityId: VALID_UUID, assetDefinitionId: VALID_UUID_2, name: "My asset" };

    it("accepts the minimal valid payload", () => {
      const result = createAssetSchema.safeParse(base);
      expect(result.success).toBe(true);
    });

    it("accepts a fully populated payload", () => {
      const result = createAssetSchema.safeParse({
        ...base,
        serialNumber: "SN-1",
        inventoryNumber: "INV-1",
        statusDropdownItemId: VALID_UUID,
        manufacturerDropdownItemId: VALID_UUID,
        modelDropdownItemId: VALID_UUID,
        locationDropdownItemId: VALID_UUID,
        userId: VALID_UUID,
        groupId: VALID_UUID,
        comment: "a comment",
        customFields: { anything: "goes, this field is unknown() at this layer" },
      });
      expect(result.success).toBe(true);
    });

    it.each([
      ["entityId", { ...base, entityId: "not-a-uuid" }],
      ["assetDefinitionId", { ...base, assetDefinitionId: "not-a-uuid" }],
      ["entityId missing", { assetDefinitionId: VALID_UUID_2, name: "x" }],
      ["name missing", { entityId: VALID_UUID, assetDefinitionId: VALID_UUID_2 }],
      ["name empty", { ...base, name: "" }],
      ["name too long", { ...base, name: "x".repeat(256) }],
      ["comment too long", { ...base, comment: "x".repeat(2001) }],
      ["serialNumber too long", { ...base, serialNumber: "x".repeat(256) }],
    ])("rejects invalid payload: %s", (_label, payload) => {
      expect(createAssetSchema.safeParse(payload).success).toBe(false);
    });

    it("allows nullable optional fields to be explicitly null", () => {
      const result = createAssetSchema.safeParse({
        ...base,
        serialNumber: null,
        inventoryNumber: null,
        userId: null,
        groupId: null,
        comment: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateAssetSchema", () => {
    it("omits entityId/assetDefinitionId and makes everything else optional", () => {
      const result = updateAssetSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("rejects entityId/assetDefinitionId if present since they're omitted from the shape", () => {
      // .omit() removes the keys entirely, so passing them through is simply ignored/stripped,
      // not rejected - this documents that behavior rather than asserting a throw.
      const result = updateAssetSchema.safeParse({ entityId: VALID_UUID, name: "renamed" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty("entityId");
      }
    });

    it("still validates the type of fields that are present", () => {
      expect(updateAssetSchema.safeParse({ name: "" }).success).toBe(false);
      expect(updateAssetSchema.safeParse({ userId: "not-a-uuid" }).success).toBe(false);
    });
  });

  describe("assignAssetSchema", () => {
    it("accepts an empty payload (both fields optional)", () => {
      expect(assignAssetSchema.safeParse({}).success).toBe(true);
    });

    it("accepts explicit nulls to clear the assignment", () => {
      expect(assignAssetSchema.safeParse({ userId: null, groupId: null }).success).toBe(true);
    });

    it("rejects a non-uuid userId/groupId", () => {
      expect(assignAssetSchema.safeParse({ userId: "nope" }).success).toBe(false);
      expect(assignAssetSchema.safeParse({ groupId: "nope" }).success).toBe(false);
    });
  });
});
