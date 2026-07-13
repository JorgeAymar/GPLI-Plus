import { describe, expect, it } from "vitest";
import { addAssetComponentSchema, assetComponentTypeSchema, createComputerSchema } from "./computer.zod";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

describe("computer.zod", () => {
  describe("createComputerSchema", () => {
    it("accepts the minimal valid payload", () => {
      expect(createComputerSchema.safeParse({ entityId: VALID_UUID, name: "PC-1" }).success).toBe(true);
    });

    it("accepts a fully populated payload including computer-specific fields", () => {
      const result = createComputerSchema.safeParse({
        entityId: VALID_UUID,
        name: "PC-1",
        osDropdownItemId: VALID_UUID,
        osVersionDropdownItemId: VALID_UUID,
        domain: "corp.local",
        customFields: { anything: "unknown() at this layer" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects a missing/invalid entityId or name", () => {
      expect(createComputerSchema.safeParse({ name: "PC-1" }).success).toBe(false);
      expect(createComputerSchema.safeParse({ entityId: "not-a-uuid", name: "PC-1" }).success).toBe(false);
      expect(createComputerSchema.safeParse({ entityId: VALID_UUID, name: "" }).success).toBe(false);
    });

    it("rejects a domain string over 255 characters", () => {
      expect(createComputerSchema.safeParse({ entityId: VALID_UUID, name: "PC-1", domain: "x".repeat(256) }).success).toBe(false);
    });
  });

  describe("assetComponentTypeSchema", () => {
    it("accepts every known component type", () => {
      for (const type of ["cpu", "ram", "disk", "gpu", "psu", "motherboard", "nic", "other"]) {
        expect(assetComponentTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it("rejects an unknown component type", () => {
      expect(assetComponentTypeSchema.safeParse("keyboard").success).toBe(false);
    });
  });

  describe("addAssetComponentSchema", () => {
    const base = { assetId: VALID_UUID, componentType: "ram" as const, name: "16GB stick" };

    it("accepts the minimal valid payload", () => {
      expect(addAssetComponentSchema.safeParse(base).success).toBe(true);
    });

    it("accepts capacityValue/capacityUnit/serialNumber/quantity", () => {
      const result = addAssetComponentSchema.safeParse({ ...base, quantity: 2, capacityValue: 16, capacityUnit: "GB", serialNumber: "SN" });
      expect(result.success).toBe(true);
    });

    it("rejects quantity below 1 and a non-integer capacityValue", () => {
      expect(addAssetComponentSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
      expect(addAssetComponentSchema.safeParse({ ...base, capacityValue: 1.5 }).success).toBe(false);
    });

    it("rejects an invalid componentType", () => {
      expect(addAssetComponentSchema.safeParse({ ...base, componentType: "keyboard" }).success).toBe(false);
    });
  });
});
