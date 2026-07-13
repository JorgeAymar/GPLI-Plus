import { describe, expect, it } from "vitest";
import { createTicketFieldDefinitionSchema, ticketFieldTypeSchema } from "./ticket-field.zod";

describe("ticket-field.zod", () => {
  it("accepts a minimal valid field definition", () => {
    expect(createTicketFieldDefinitionSchema.safeParse({ key: "department", label: "Departamento", fieldType: "text" }).success).toBe(
      true,
    );
  });

  it("allows ticketType to be null (applies to both incident and request) or omitted", () => {
    expect(
      createTicketFieldDefinitionSchema.safeParse({ ticketType: null, key: "k", label: "l", fieldType: "text" }).success,
    ).toBe(true);
    expect(createTicketFieldDefinitionSchema.safeParse({ key: "k", label: "l", fieldType: "text" }).success).toBe(true);
  });

  it("rejects an invalid ticketType", () => {
    expect(
      createTicketFieldDefinitionSchema.safeParse({ ticketType: "problem", key: "k", label: "l", fieldType: "text" }).success,
    ).toBe(false);
  });

  it.each(["has space", "hyphen-ated", "special!", ""])("rejects a key with disallowed characters (%s)", (key) => {
    expect(createTicketFieldDefinitionSchema.safeParse({ key, label: "l", fieldType: "text" }).success).toBe(false);
  });

  it("accepts a key with only letters, digits, and underscores", () => {
    expect(createTicketFieldDefinitionSchema.safeParse({ key: "field_2", label: "l", fieldType: "text" }).success).toBe(true);
  });

  it("rejects an invalid fieldType", () => {
    expect(createTicketFieldDefinitionSchema.safeParse({ key: "k", label: "l", fieldType: "richtext" }).success).toBe(false);
  });

  it("ticketFieldTypeSchema accepts exactly the six known field types", () => {
    for (const type of ["text", "textarea", "number", "boolean", "date", "dropdown"]) {
      expect(ticketFieldTypeSchema.safeParse(type).success).toBe(true);
    }
    expect(ticketFieldTypeSchema.safeParse("email").success).toBe(false);
  });
});
