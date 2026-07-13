import { describe, expect, it } from "vitest";
import {
  createInstallationSchema,
  createSoftwareLicenseSchema,
  createSoftwareSchema,
  createSoftwareVersionSchema,
  licenseTypeSchema,
} from "./software.zod";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

describe("software.zod", () => {
  describe("licenseTypeSchema", () => {
    it("accepts every known license type", () => {
      for (const type of ["per_seat", "per_device", "volume", "subscription", "oem", "freeware"]) {
        expect(licenseTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it("rejects an unknown license type", () => {
      expect(licenseTypeSchema.safeParse("trial").success).toBe(false);
    });
  });

  describe("createSoftwareSchema", () => {
    it("accepts the minimal valid payload", () => {
      expect(createSoftwareSchema.safeParse({ entityId: VALID_UUID, name: "Office" }).success).toBe(true);
    });

    it("rejects a missing name or invalid entityId", () => {
      expect(createSoftwareSchema.safeParse({ entityId: VALID_UUID }).success).toBe(false);
      expect(createSoftwareSchema.safeParse({ entityId: "nope", name: "Office" }).success).toBe(false);
    });
  });

  describe("createSoftwareVersionSchema", () => {
    it("accepts the minimal valid payload", () => {
      expect(createSoftwareVersionSchema.safeParse({ softwareId: VALID_UUID, name: "1.0" }).success).toBe(true);
    });

    it("rejects a name over 100 characters", () => {
      expect(createSoftwareVersionSchema.safeParse({ softwareId: VALID_UUID, name: "x".repeat(101) }).success).toBe(false);
    });
  });

  describe("createSoftwareLicenseSchema", () => {
    const base = { entityId: VALID_UUID, softwareId: VALID_UUID, name: "License A", licenseType: "per_seat" as const };

    it("accepts the minimal valid payload", () => {
      expect(createSoftwareLicenseSchema.safeParse(base).success).toBe(true);
    });

    it("coerces string dates to Date objects", () => {
      const result = createSoftwareLicenseSchema.safeParse({ ...base, purchaseDate: "2024-01-01", expirationDate: "2025-01-01" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.purchaseDate).toBeInstanceOf(Date);
        expect(result.data.expirationDate).toBeInstanceOf(Date);
      }
    });

    it("rejects an invalid licenseType and a negative seatsTotal", () => {
      expect(createSoftwareLicenseSchema.safeParse({ ...base, licenseType: "trial" }).success).toBe(false);
      expect(createSoftwareLicenseSchema.safeParse({ ...base, seatsTotal: -1 }).success).toBe(false);
    });

    it("rejects an unparsable date string", () => {
      expect(createSoftwareLicenseSchema.safeParse({ ...base, purchaseDate: "not-a-date" }).success).toBe(false);
    });
  });

  describe("createInstallationSchema", () => {
    it("accepts the minimal valid payload", () => {
      expect(createInstallationSchema.safeParse({ assetId: VALID_UUID, softwareVersionId: VALID_UUID }).success).toBe(true);
    });

    it("rejects a missing assetId/softwareVersionId", () => {
      expect(createInstallationSchema.safeParse({ softwareVersionId: VALID_UUID }).success).toBe(false);
      expect(createInstallationSchema.safeParse({ assetId: VALID_UUID }).success).toBe(false);
    });
  });
});
