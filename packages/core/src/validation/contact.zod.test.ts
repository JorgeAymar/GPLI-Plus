import { describe, expect, it } from "vitest";
import { createContactSchema } from "./contact.zod";

const VALID_ENTITY_ID = "11111111-1111-1111-1111-111111111111";
const VALID_SUPPLIER_ID = "22222222-2222-2222-2222-222222222222";

describe("createContactSchema", () => {
  it("accepts a minimal valid payload (firstName + lastName required, no supplier)", () => {
    const result = createContactSchema.parse({ entityId: VALID_ENTITY_ID, firstName: "Ada", lastName: "Lovelace" });
    expect(result.supplierId).toBeUndefined();
  });

  it("accepts a fully populated payload with a supplierId", () => {
    const result = createContactSchema.parse({
      entityId: VALID_ENTITY_ID,
      supplierId: VALID_SUPPLIER_ID,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+1 555 0100",
      comment: "primary technical contact",
    });
    expect(result.supplierId).toBe(VALID_SUPPLIER_ID);
  });

  it("accepts an explicit null supplierId (unaffiliated contact)", () => {
    const result = createContactSchema.parse({
      entityId: VALID_ENTITY_ID,
      supplierId: null,
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(result.supplierId).toBeNull();
  });

  it.each([
    ["missing entityId", { firstName: "Ada", lastName: "Lovelace" }],
    ["missing firstName", { entityId: VALID_ENTITY_ID, lastName: "Lovelace" }],
    ["empty firstName", { entityId: VALID_ENTITY_ID, firstName: "", lastName: "Lovelace" }],
    ["missing lastName", { entityId: VALID_ENTITY_ID, firstName: "Ada" }],
    ["non-uuid supplierId", { entityId: VALID_ENTITY_ID, supplierId: "nope", firstName: "Ada", lastName: "Lovelace" }],
    [
      "invalid email",
      { entityId: VALID_ENTITY_ID, firstName: "Ada", lastName: "Lovelace", email: "not-an-email" },
    ],
    [
      "lastName over 255 chars",
      { entityId: VALID_ENTITY_ID, firstName: "Ada", lastName: "a".repeat(256) },
    ],
  ])("rejects %s", (_label, payload) => {
    expect(createContactSchema.safeParse(payload).success).toBe(false);
  });
});
