import { describe, expect, it } from "vitest";
import { createCertificateSchema } from "./certificate.zod";

const VALID_ENTITY_ID = "11111111-1111-1111-1111-111111111111";
const VALID_ASSET_ID = "44444444-4444-4444-4444-444444444444";

describe("createCertificateSchema", () => {
  it("accepts a minimal valid payload, leaving certificateType to the service default", () => {
    const result = createCertificateSchema.parse({ entityId: VALID_ENTITY_ID, name: "example.com SSL" });
    expect(result.certificateType).toBeUndefined();
    expect(result.assignedAssetId).toBeUndefined();
  });

  it("accepts every certificateType enum value", () => {
    for (const certificateType of ["ssl", "code_signing", "other"] as const) {
      expect(
        createCertificateSchema.safeParse({ entityId: VALID_ENTITY_ID, name: "x", certificateType }).success,
      ).toBe(true);
    }
  });

  it("coerces validFrom/validUntil date strings to Date instances, past or future", () => {
    const expired = createCertificateSchema.parse({
      entityId: VALID_ENTITY_ID,
      name: "expired cert",
      validFrom: "2020-01-01",
      validUntil: "2021-01-01",
    });
    const future = createCertificateSchema.parse({
      entityId: VALID_ENTITY_ID,
      name: "future cert",
      validFrom: "2026-01-01",
      validUntil: "2030-01-01",
    });
    expect(expired.validUntil).toBeInstanceOf(Date);
    expect(expired.validUntil!.getTime()).toBeLessThan(Date.now());
    expect(future.validUntil).toBeInstanceOf(Date);
    expect(future.validUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("does not reject validUntil earlier than validFrom - no cross-field ordering check exists", () => {
    // Documents current behavior: the schema validates each date independently.
    const result = createCertificateSchema.safeParse({
      entityId: VALID_ENTITY_ID,
      name: "backwards range",
      validFrom: "2030-01-01",
      validUntil: "2020-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid assignedAssetId", () => {
    const result = createCertificateSchema.parse({
      entityId: VALID_ENTITY_ID,
      name: "assigned cert",
      assignedAssetId: VALID_ASSET_ID,
    });
    expect(result.assignedAssetId).toBe(VALID_ASSET_ID);
  });

  it.each([
    ["invalid certificateType", { entityId: VALID_ENTITY_ID, name: "x", certificateType: "wildcard" }],
    ["non-uuid assignedAssetId", { entityId: VALID_ENTITY_ID, name: "x", assignedAssetId: "nope" }],
    ["invalid validFrom", { entityId: VALID_ENTITY_ID, name: "x", validFrom: "not-a-date" }],
    ["missing name", { entityId: VALID_ENTITY_ID }],
    ["missing entityId", { name: "x" }],
    ["issuer over 255 chars", { entityId: VALID_ENTITY_ID, name: "x", issuer: "a".repeat(256) }],
  ])("rejects %s", (_label, payload) => {
    expect(createCertificateSchema.safeParse(payload).success).toBe(false);
  });
});
