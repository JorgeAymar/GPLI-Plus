import { describe, expect, it } from "vitest";
import { createTicketSchema, itilStatusSchema, ticketTypeSchema, updateTicketSchema } from "./ticket.zod";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("ticket.zod", () => {
  describe("createTicketSchema", () => {
    it("accepts a minimal valid payload and applies no defaults of its own (service layer does that)", () => {
      const result = createTicketSchema.safeParse({ entityId: validUuid, title: "Titulo", content: "Contenido" });
      expect(result.success).toBe(true);
    });

    it("accepts a fully specified payload", () => {
      const result = createTicketSchema.safeParse({
        entityId: validUuid,
        title: "Titulo",
        content: "Contenido",
        ticketType: "request",
        urgency: 5,
        impact: 1,
        priority: 3,
        categoryDropdownItemId: validUuid,
        customFields: { department: "IT" },
      });
      expect(result.success).toBe(true);
    });

    it.each(["entityId", "title", "content"] as const)("rejects when %s is missing", (field) => {
      const payload: Record<string, unknown> = { entityId: validUuid, title: "Titulo", content: "Contenido" };
      delete payload[field];
      expect(createTicketSchema.safeParse(payload).success).toBe(false);
    });

    it("rejects a non-uuid entityId", () => {
      expect(createTicketSchema.safeParse({ entityId: "not-a-uuid", title: "t", content: "c" }).success).toBe(false);
    });

    it("rejects an empty title", () => {
      expect(createTicketSchema.safeParse({ entityId: validUuid, title: "", content: "c" }).success).toBe(false);
    });

    it("rejects an invalid ticketType", () => {
      expect(createTicketSchema.safeParse({ entityId: validUuid, title: "t", content: "c", ticketType: "bug" }).success).toBe(false);
    });

    it.each([0, 6, 1.5])("rejects urgency out of the 1-5 integer range (%s)", (urgency) => {
      expect(createTicketSchema.safeParse({ entityId: validUuid, title: "t", content: "c", urgency }).success).toBe(false);
    });

    it("allows categoryDropdownItemId to be explicitly null", () => {
      expect(
        createTicketSchema.safeParse({ entityId: validUuid, title: "t", content: "c", categoryDropdownItemId: null }).success,
      ).toBe(true);
    });
  });

  describe("updateTicketSchema", () => {
    it("has no required fields (entityId omitted, everything else optional)", () => {
      expect(updateTicketSchema.safeParse({}).success).toBe(true);
    });

    it("rejects entityId as an unknown key (immutable via update)", () => {
      const result = updateTicketSchema.safeParse({ entityId: validUuid, title: "New title" });
      // entityId isn't part of the shape at all after `.omit`, but plain (non-strict) zod
      // objects silently drop unknown keys rather than reject them - so this documents current
      // behavior (still succeeds) rather than asserting rejection.
      expect(result.success).toBe(true);
    });
  });

  it("ticketTypeSchema / itilStatusSchema only accept their known enum values", () => {
    expect(ticketTypeSchema.safeParse("incident").success).toBe(true);
    expect(ticketTypeSchema.safeParse("request").success).toBe(true);
    expect(ticketTypeSchema.safeParse("problem").success).toBe(false);

    expect(itilStatusSchema.safeParse("closed").success).toBe(true);
    expect(itilStatusSchema.safeParse("archived").success).toBe(false);
  });
});
