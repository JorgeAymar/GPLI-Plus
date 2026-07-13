import { describe, expect, it } from "vitest";
import { assetFieldTypeSchema, createAssetDefinitionSchema, createAssetFieldDefinitionSchema } from "./asset-definition.zod";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

describe("asset-definition.zod", () => {
  describe("assetFieldTypeSchema", () => {
    it("accepts every known field type", () => {
      for (const type of ["text", "textarea", "number", "boolean", "date", "dropdown"]) {
        expect(assetFieldTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it("rejects an unknown field type", () => {
      expect(assetFieldTypeSchema.safeParse("richtext").success).toBe(false);
    });
  });

  describe("createAssetDefinitionSchema", () => {
    it("accepts a lowercase snake_case key", () => {
      expect(createAssetDefinitionSchema.safeParse({ key: "custom_type", name: "Custom Type" }).success).toBe(true);
    });

    it("rejects a key with uppercase letters", () => {
      expect(createAssetDefinitionSchema.safeParse({ key: "CustomType", name: "Custom Type" }).success).toBe(false);
    });

    it("rejects a key with hyphens or spaces", () => {
      expect(createAssetDefinitionSchema.safeParse({ key: "custom-type", name: "Custom Type" }).success).toBe(false);
      expect(createAssetDefinitionSchema.safeParse({ key: "custom type", name: "Custom Type" }).success).toBe(false);
    });

    it("rejects a missing name or empty key", () => {
      expect(createAssetDefinitionSchema.safeParse({ key: "custom_type" }).success).toBe(false);
      expect(createAssetDefinitionSchema.safeParse({ key: "", name: "Custom Type" }).success).toBe(false);
    });
  });

  describe("createAssetFieldDefinitionSchema", () => {
    const base = { assetDefinitionId: VALID_UUID, key: "warranty_months", label: "Warranty (months)", fieldType: "number" as const };

    it("accepts the minimal valid payload", () => {
      expect(createAssetFieldDefinitionSchema.safeParse(base).success).toBe(true);
    });

    it("accepts a key with uppercase letters (looser regex than the asset definition's own key)", () => {
      expect(createAssetFieldDefinitionSchema.safeParse({ ...base, key: "warrantyMonths" }).success).toBe(true);
    });

    it("rejects a key with hyphens or spaces", () => {
      expect(createAssetFieldDefinitionSchema.safeParse({ ...base, key: "warranty-months" }).success).toBe(false);
      expect(createAssetFieldDefinitionSchema.safeParse({ ...base, key: "warranty months" }).success).toBe(false);
    });

    it("rejects an invalid fieldType", () => {
      expect(createAssetFieldDefinitionSchema.safeParse({ ...base, fieldType: "richtext" }).success).toBe(false);
    });

    it("accepts isRequired/defaultValue/sortOrder/dropdownCategoryId", () => {
      const result = createAssetFieldDefinitionSchema.safeParse({
        ...base,
        isRequired: true,
        defaultValue: "12",
        sortOrder: 3,
        dropdownCategoryId: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });
  });
});
