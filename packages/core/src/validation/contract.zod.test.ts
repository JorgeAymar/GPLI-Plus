import { describe, expect, it } from "vitest";
import { createContractSchema, linkContractAssetSchema } from "./contract.zod";

const VALID_ENTITY_ID = "11111111-1111-1111-1111-111111111111";
const VALID_SUPPLIER_ID = "22222222-2222-2222-2222-222222222222";
const VALID_CONTRACT_ID = "33333333-3333-3333-3333-333333333333";
const VALID_ASSET_ID = "44444444-4444-4444-4444-444444444444";

describe("createContractSchema", () => {
  it("accepts a minimal valid payload, leaving contractType/billingFrequency to the service defaults", () => {
    const result = createContractSchema.parse({ entityId: VALID_ENTITY_ID, name: "Minimal contract" });
    expect(result.contractType).toBeUndefined();
    expect(result.billingFrequency).toBeUndefined();
  });

  it("accepts every enum value for contractType and billingFrequency", () => {
    for (const contractType of ["maintenance", "lease", "license", "support", "other"] as const) {
      expect(createContractSchema.safeParse({ entityId: VALID_ENTITY_ID, name: "x", contractType }).success).toBe(true);
    }
    for (const billingFrequency of ["monthly", "quarterly", "annual", "one_time"] as const) {
      expect(createContractSchema.safeParse({ entityId: VALID_ENTITY_ID, name: "x", billingFrequency }).success).toBe(true);
    }
  });

  it("coerces ISO date strings to Date instances for startDate/endDate", () => {
    const result = createContractSchema.parse({
      entityId: VALID_ENTITY_ID,
      name: "Full contract",
      supplierId: VALID_SUPPLIER_ID,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      costCents: 15000,
      renewalNoticeDays: 30,
    });
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeInstanceOf(Date);
  });

  it.each([
    ["invalid contractType", { entityId: VALID_ENTITY_ID, name: "x", contractType: "warranty" }],
    ["invalid billingFrequency", { entityId: VALID_ENTITY_ID, name: "x", billingFrequency: "weekly" }],
    ["negative costCents", { entityId: VALID_ENTITY_ID, name: "x", costCents: -1 }],
    ["non-integer costCents", { entityId: VALID_ENTITY_ID, name: "x", costCents: 10.5 }],
    ["negative renewalNoticeDays", { entityId: VALID_ENTITY_ID, name: "x", renewalNoticeDays: -5 }],
    ["invalid startDate", { entityId: VALID_ENTITY_ID, name: "x", startDate: "not-a-date" }],
    ["missing name", { entityId: VALID_ENTITY_ID }],
    ["missing entityId", { name: "x" }],
  ])("rejects %s", (_label, payload) => {
    expect(createContractSchema.safeParse(payload).success).toBe(false);
  });
});

describe("linkContractAssetSchema", () => {
  it("accepts a valid contractId/assetId pair", () => {
    const result = linkContractAssetSchema.parse({ contractId: VALID_CONTRACT_ID, assetId: VALID_ASSET_ID });
    expect(result).toEqual({ contractId: VALID_CONTRACT_ID, assetId: VALID_ASSET_ID });
  });

  it.each([
    ["missing contractId", { assetId: VALID_ASSET_ID }],
    ["missing assetId", { contractId: VALID_CONTRACT_ID }],
    ["non-uuid contractId", { contractId: "nope", assetId: VALID_ASSET_ID }],
  ])("rejects %s", (_label, payload) => {
    expect(linkContractAssetSchema.safeParse(payload).success).toBe(false);
  });
});
