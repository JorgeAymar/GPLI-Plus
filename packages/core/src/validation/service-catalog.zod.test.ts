import { describe, expect, it } from "vitest";
import { createServiceCatalogItemSchema } from "./service-catalog.zod";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("service-catalog.zod", () => {
  it("accepts a minimal valid payload", () => {
    expect(createServiceCatalogItemSchema.safeParse({ entityId: validUuid, name: "Solicitud de laptop" }).success).toBe(true);
  });

  it("reuses ticket.zod's ticketTypeSchema - only incident/request are valid", () => {
    expect(createServiceCatalogItemSchema.safeParse({ entityId: validUuid, name: "n", ticketType: "request" }).success).toBe(true);
    expect(createServiceCatalogItemSchema.safeParse({ entityId: validUuid, name: "n", ticketType: "task" }).success).toBe(false);
  });

  it("rejects a missing name or entityId", () => {
    expect(createServiceCatalogItemSchema.safeParse({ entityId: validUuid }).success).toBe(false);
    expect(createServiceCatalogItemSchema.safeParse({ name: "n" }).success).toBe(false);
  });

  it("allows description to be explicitly null", () => {
    expect(createServiceCatalogItemSchema.safeParse({ entityId: validUuid, name: "n", description: null }).success).toBe(true);
  });
});
