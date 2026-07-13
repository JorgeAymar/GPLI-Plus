import { describe, expect, it } from "vitest";
import { addConsumableUnitsSchema, createConsumableItemSchema, useConsumableSchema } from "./consumable.zod";

const VALID_ENTITY_ID = "11111111-1111-1111-1111-111111111111";
const VALID_SUPPLIER_ID = "22222222-2222-2222-2222-222222222222";
const VALID_ITEM_ID = "55555555-5555-5555-5555-555555555555";
const VALID_ASSET_ID = "44444444-4444-4444-4444-444444444444";
const VALID_CONSUMABLE_ID = "66666666-6666-6666-6666-666666666666";

describe("createConsumableItemSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = createConsumableItemSchema.parse({ entityId: VALID_ENTITY_ID, name: "Toner HP 26X" });
    expect(result.supplierId).toBeUndefined();
    expect(result.alertThreshold).toBeUndefined();
  });

  it("accepts a fully populated payload with a supplier and alert threshold", () => {
    const result = createConsumableItemSchema.parse({
      entityId: VALID_ENTITY_ID,
      name: "Toner HP 26X",
      supplierId: VALID_SUPPLIER_ID,
      alertThreshold: 5,
      comment: "reorder above 5 units",
    });
    expect(result.alertThreshold).toBe(5);
  });

  it("accepts alertThreshold of exactly 0 (min boundary is inclusive)", () => {
    expect(
      createConsumableItemSchema.safeParse({ entityId: VALID_ENTITY_ID, name: "x", alertThreshold: 0 }).success,
    ).toBe(true);
  });

  it.each([
    ["missing name", { entityId: VALID_ENTITY_ID }],
    ["empty name", { entityId: VALID_ENTITY_ID, name: "" }],
    ["missing entityId", { name: "x" }],
    ["non-uuid supplierId", { entityId: VALID_ENTITY_ID, name: "x", supplierId: "nope" }],
    ["negative alertThreshold", { entityId: VALID_ENTITY_ID, name: "x", alertThreshold: -1 }],
    ["non-integer alertThreshold", { entityId: VALID_ENTITY_ID, name: "x", alertThreshold: 1.5 }],
  ])("rejects %s", (_label, payload) => {
    expect(createConsumableItemSchema.safeParse(payload).success).toBe(false);
  });
});

describe("addConsumableUnitsSchema", () => {
  it("accepts the quantity boundaries (1 and 1000 inclusive)", () => {
    expect(addConsumableUnitsSchema.safeParse({ consumableItemId: VALID_ITEM_ID, quantity: 1 }).success).toBe(true);
    expect(addConsumableUnitsSchema.safeParse({ consumableItemId: VALID_ITEM_ID, quantity: 1000 }).success).toBe(true);
  });

  it.each([
    ["quantity of 0 (below min)", { consumableItemId: VALID_ITEM_ID, quantity: 0 }],
    ["quantity of 1001 (above max)", { consumableItemId: VALID_ITEM_ID, quantity: 1001 }],
    ["negative quantity", { consumableItemId: VALID_ITEM_ID, quantity: -5 }],
    ["non-integer quantity", { consumableItemId: VALID_ITEM_ID, quantity: 2.5 }],
    ["missing quantity", { consumableItemId: VALID_ITEM_ID }],
    ["non-uuid consumableItemId", { consumableItemId: "nope", quantity: 5 }],
    ["missing consumableItemId", { quantity: 5 }],
  ])("rejects %s", (_label, payload) => {
    expect(addConsumableUnitsSchema.safeParse(payload).success).toBe(false);
  });
});

describe("useConsumableSchema", () => {
  it("accepts a valid id/assignedAssetId pair", () => {
    const result = useConsumableSchema.parse({ id: VALID_CONSUMABLE_ID, assignedAssetId: VALID_ASSET_ID });
    expect(result).toEqual({ id: VALID_CONSUMABLE_ID, assignedAssetId: VALID_ASSET_ID });
  });

  it.each([
    ["missing assignedAssetId - unlike the DB column, this field is not optional here", { id: VALID_CONSUMABLE_ID }],
    ["missing id", { assignedAssetId: VALID_ASSET_ID }],
    ["non-uuid id", { id: "nope", assignedAssetId: VALID_ASSET_ID }],
    ["non-uuid assignedAssetId", { id: VALID_CONSUMABLE_ID, assignedAssetId: "nope" }],
  ])("rejects %s", (_label, payload) => {
    expect(useConsumableSchema.safeParse(payload).success).toBe(false);
  });
});
