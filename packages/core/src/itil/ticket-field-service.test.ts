import { db, ticketFieldDefinitions } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildTicketDynamicSchema,
  createTicketFieldDefinition,
  listTicketFieldDefinitions,
  validateTicketCustomFields,
} from "./ticket-field-service";

/**
 * `ticketType` on ticket_field_definitions is a decoupled plain-text column (see the schema
 * header comment), so we can scope every definition created here to a throwaway fake type
 * ("__vitest_itil__*") that will never match a real ticket's "incident"/"request" enum value.
 * That keeps this file fully isolated from real ticket creation elsewhere in the suite - no
 * shared entity/user setup needed, and nothing here can affect another test file's tickets.
 */
const FAKE_TYPE = "__vitest_itil__ticket_field_type";
const createdIds: string[] = [];

async function makeField(input: Parameters<typeof createTicketFieldDefinition>[0]) {
  const created = await createTicketFieldDefinition(input);
  createdIds.push(created.id);
  return created;
}

afterAll(async () => {
  if (createdIds.length === 0) return;
  for (const id of createdIds) {
    await db.delete(ticketFieldDefinitions).where(eq(ticketFieldDefinitions.id, id));
  }
});

describe("ticket-field-service", () => {
  describe("createTicketFieldDefinition / listTicketFieldDefinitions", () => {
    it("creates a field definition with defaults", async () => {
      const field = await makeField({
        ticketType: FAKE_TYPE,
        key: "__vitest_itil__dept",
        label: "Departamento",
        fieldType: "text",
      });

      expect(field.isRequired).toBe(false);
      expect(field.sortOrder).toBe(0);
      expect(field.dropdownCategoryId).toBeNull();
    });

    it("lists fields for an exact ticketType match plus type-agnostic (null) fields", async () => {
      const specific = await makeField({
        ticketType: FAKE_TYPE,
        key: "__vitest_itil__specific",
        label: "Specific",
        fieldType: "text",
        sortOrder: 2,
      });
      const shared = await makeField({
        ticketType: null,
        key: "__vitest_itil__shared_field",
        label: "Shared",
        fieldType: "text",
        sortOrder: 1,
      });

      const fields = await listTicketFieldDefinitions(FAKE_TYPE);
      const ids = fields.map((f) => f.id);
      expect(ids).toContain(specific.id);
      expect(ids).toContain(shared.id);

      // Ordered by sortOrder ascending - the shared (sortOrder 1) field comes before the
      // type-specific (sortOrder 2) one.
      const sharedIndex = fields.findIndex((f) => f.id === shared.id);
      const specificIndex = fields.findIndex((f) => f.id === specific.id);
      expect(sharedIndex).toBeLessThan(specificIndex);
    });

    it("omitting ticketType returns definitions across every type", async () => {
      const field = await makeField({
        ticketType: FAKE_TYPE,
        key: "__vitest_itil__any_type",
        label: "Any type",
        fieldType: "text",
      });

      const all = await listTicketFieldDefinitions();
      expect(all.map((f) => f.id)).toContain(field.id);
    });
  });

  describe("validateTicketCustomFields (Form Builder validation)", () => {
    // Each test below gets its OWN fake ticketType (rather than sharing FAKE_TYPE) so the field
    // definitions it creates can never leak into another test's schema. Field definitions are
    // global (not entity-scoped) and validateTicketCustomFields() aggregates every definition
    // that matches a given ticketType, so two tests sharing one ticketType would silently
    // accumulate each other's "required" fields - exactly the bug that broke this file the first
    // time it was written: later tests failed with "Required" errors for keys defined by earlier
    // tests, purely because of shared type + no per-test cleanup.
    it("rejects when a required field is missing", async () => {
      const type = "__vitest_itil__vtc_missing_required";
      await makeField({ ticketType: type, key: "department", label: "Departamento", fieldType: "text", isRequired: true });

      await expect(validateTicketCustomFields(type, {})).rejects.toThrow();
    });

    it("rejects a required text field submitted as a blank string", async () => {
      const type = "__vitest_itil__vtc_blank_required";
      await makeField({ ticketType: type, key: "note", label: "Requerido", fieldType: "text", isRequired: true });

      await expect(validateTicketCustomFields(type, { note: "" })).rejects.toThrow();
    });

    it("accepts and coerces values when all required fields are present", async () => {
      const type = "__vitest_itil__vtc_all_present";
      await makeField({ ticketType: type, key: "ok_text", label: "Texto", fieldType: "text", isRequired: true });
      await makeField({ ticketType: type, key: "ok_number", label: "Numero", fieldType: "number" });

      const result = await validateTicketCustomFields(type, { ok_text: "hola", ok_number: "42" });

      expect(result.ok_text).toBe("hola");
      // z.coerce.number() turns the numeric string into a real number.
      expect(result.ok_number).toBe(42);
    });

    it("rejects unknown custom field keys (.strict())", async () => {
      const type = "__vitest_itil__vtc_no_fields";
      await expect(validateTicketCustomFields(type, { totally_unknown_key: "x" })).rejects.toThrow();
    });

    it("coerces boolean-like strings correctly (regression: bare z.coerce.boolean() bug)", async () => {
      const type = "__vitest_itil__vtc_boolean";
      await makeField({ ticketType: type, key: "flag", label: "Flag", fieldType: "boolean" });

      // Before the fix, z.coerce.boolean() used JS `Boolean(value)`, so the literal string
      // "false" (a non-empty string) coerced to `true`. That's the exact bug already fixed once
      // in assets/dynamic-schema.ts but present here too until this pass.
      const parsedFalse = await validateTicketCustomFields(type, { flag: "false" });
      expect(parsedFalse.flag).toBe(false);

      const parsedTrue = await validateTicketCustomFields(type, { flag: "true" });
      expect(parsedTrue.flag).toBe(true);

      const parsedRealBoolean = await validateTicketCustomFields(type, { flag: false });
      expect(parsedRealBoolean.flag).toBe(false);
    });

    it("rejects a non-uuid value for a dropdown field", async () => {
      const type = "__vitest_itil__vtc_dropdown";
      await makeField({ ticketType: type, key: "category", label: "Categoria", fieldType: "dropdown", isRequired: true });

      await expect(validateTicketCustomFields(type, { category: "not-a-uuid" })).rejects.toThrow();
    });

    it("coerces an ISO date string into a Date for a date field", async () => {
      const type = "__vitest_itil__vtc_date";
      await makeField({ ticketType: type, key: "due", label: "Vencimiento", fieldType: "date" });

      const result = await validateTicketCustomFields(type, { due: "2026-01-01T00:00:00.000Z" });
      expect(result.due).toBeInstanceOf(Date);
    });

    it("with no field definitions for a type, an empty input validates to an empty object", async () => {
      const result = await validateTicketCustomFields("__vitest_itil__vtc_no_defs_at_all", {});
      expect(result).toEqual({});
    });
  });

  describe("buildTicketDynamicSchema", () => {
    it("builds a strict zod object matching the given field definitions", () => {
      const schema = buildTicketDynamicSchema([
        {
          id: "00000000-0000-0000-0000-000000000000",
          ticketType: FAKE_TYPE,
          key: "note",
          label: "Note",
          fieldType: "text",
          dropdownCategoryId: null,
          isRequired: false,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      expect(schema.safeParse({ note: "hi" }).success).toBe(true);
      expect(schema.safeParse({ note: "hi", extra: 1 }).success).toBe(false);
    });
  });
});
