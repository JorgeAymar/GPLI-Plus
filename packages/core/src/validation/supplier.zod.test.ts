import { describe, expect, it } from "vitest";
import { createSupplierSchema } from "./supplier.zod";

const VALID_ENTITY_ID = "11111111-1111-1111-1111-111111111111";

describe("createSupplierSchema", () => {
  it("accepts a minimal valid payload and defaults optional fields to undefined", () => {
    const result = createSupplierSchema.parse({ entityId: VALID_ENTITY_ID, name: "Acme Corp" });
    expect(result).toEqual({ entityId: VALID_ENTITY_ID, name: "Acme Corp" });
  });

  it("accepts a fully populated payload, including explicit nulls for optional fields", () => {
    const result = createSupplierSchema.parse({
      entityId: VALID_ENTITY_ID,
      name: "Acme Corp",
      phone: "+1 555 0100",
      email: "sales@acme.test",
      website: "https://acme.test",
      address: null,
      comment: null,
    });
    expect(result.phone).toBe("+1 555 0100");
    expect(result.address).toBeNull();
  });

  it.each([
    ["missing entityId", { name: "Acme Corp" }],
    ["non-uuid entityId", { entityId: "not-a-uuid", name: "Acme Corp" }],
    ["missing name", { entityId: VALID_ENTITY_ID }],
    ["empty name", { entityId: VALID_ENTITY_ID, name: "" }],
    ["name over 255 chars", { entityId: VALID_ENTITY_ID, name: "a".repeat(256) }],
    ["invalid email", { entityId: VALID_ENTITY_ID, name: "Acme Corp", email: "not-an-email" }],
    ["phone over 50 chars", { entityId: VALID_ENTITY_ID, name: "Acme Corp", phone: "1".repeat(51) }],
  ])("rejects %s", (_label, payload) => {
    expect(createSupplierSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a wrong type for a known field instead of silently coercing", () => {
    const result = createSupplierSchema.safeParse({ entityId: VALID_ENTITY_ID, name: 12345 });
    expect(result.success).toBe(false);
  });

  it("silently strips unknown top-level keys (schema is not .strict())", () => {
    const result = createSupplierSchema.parse({ entityId: VALID_ENTITY_ID, name: "Acme Corp", notAField: "surprise" });
    expect(result).not.toHaveProperty("notAField");
  });
});
