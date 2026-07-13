import "dotenv/config";
import { assetDefinitions, assetFieldDefinitions, db, type AssetFieldDefinition } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAssetDefinition } from "./asset-definition-service";
import { buildDynamicSchema, validateCustomFields } from "./dynamic-schema";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `__vitest_assets__${RUN}_`;

/** Minimal in-memory field-definition fixture for the pure buildDynamicSchema tests (no DB round-trip needed). */
function field(overrides: Partial<AssetFieldDefinition>): AssetFieldDefinition {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    assetDefinitionId: "00000000-0000-0000-0000-000000000000",
    key: "field",
    label: "Field",
    fieldType: "text",
    dropdownCategoryId: null,
    isRequired: false,
    defaultValue: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("dynamic-schema: buildDynamicSchema (pure, in-memory field defs)", () => {
  it("builds an empty strict schema when there are no field definitions", () => {
    const schema = buildDynamicSchema([]);
    expect(schema.parse({})).toEqual({});
    expect(() => schema.parse({ unexpected: "value" })).toThrow();
  });

  it("rejects unknown keys (.strict())", () => {
    const schema = buildDynamicSchema([field({ key: "known", fieldType: "text" })]);
    expect(() => schema.parse({ known: "ok", extra: "not allowed" })).toThrow();
  });

  it("requires a required field and allows omitting an optional one", () => {
    const schema = buildDynamicSchema([
      field({ key: "req", fieldType: "text", isRequired: true }),
      field({ key: "opt", fieldType: "text", isRequired: false }),
    ]);
    expect(() => schema.parse({})).toThrow();
    expect(schema.parse({ req: "value" })).toEqual({ req: "value" });
  });

  it("coerces number/boolean/date fields and validates uuid for dropdown fields", () => {
    const schema = buildDynamicSchema([
      field({ key: "num", fieldType: "number" }),
      field({ key: "bool", fieldType: "boolean" }),
      field({ key: "when", fieldType: "date" }),
      field({ key: "dd", fieldType: "dropdown" }),
    ]);
    const parsed = schema.parse({
      num: "42",
      bool: true,
      when: "2024-01-01T00:00:00.000Z",
      dd: "11111111-1111-1111-1111-111111111111",
    });
    expect(parsed.num).toBe(42);
    expect(parsed.bool).toBe(true);
    expect(parsed.when).toBeInstanceOf(Date);
    expect(parsed.dd).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("rejects a non-numeric string for a number field", () => {
    const schema = buildDynamicSchema([field({ key: "num", fieldType: "number" })]);
    expect(() => schema.parse({ num: "abc" })).toThrow();
  });

  it("rejects a non-uuid string for a dropdown field", () => {
    const schema = buildDynamicSchema([field({ key: "dd", fieldType: "dropdown" })]);
    expect(() => schema.parse({ dd: "not-a-uuid" })).toThrow();
  });

  describe("boolean field coercion (regression coverage for the Boolean(value) footgun)", () => {
    it("passes real booleans through untouched", () => {
      const schema = buildDynamicSchema([field({ key: "bool", fieldType: "boolean" })]);
      expect(schema.parse({ bool: true })).toEqual({ bool: true });
      expect(schema.parse({ bool: false })).toEqual({ bool: false });
    });

    it('coerces the strings "true"/"false" (and "1"/"0") to their real boolean value', () => {
      const schema = buildDynamicSchema([field({ key: "bool", fieldType: "boolean" })]);
      expect(schema.parse({ bool: "true" }).bool).toBe(true);
      expect(schema.parse({ bool: "false" }).bool).toBe(false);
      expect(schema.parse({ bool: "1" }).bool).toBe(true);
      expect(schema.parse({ bool: "0" }).bool).toBe(false);
    });

    it("rejects a nonsense string instead of silently coercing it to true", () => {
      const schema = buildDynamicSchema([field({ key: "bool", fieldType: "boolean" })]);
      expect(() => schema.parse({ bool: "banana" })).toThrow();
    });

    it("rejects a missing value for a REQUIRED boolean field instead of silently defaulting to false", () => {
      const schema = buildDynamicSchema([field({ key: "bool", fieldType: "boolean", isRequired: true })]);
      expect(() => schema.parse({})).toThrow();
    });
  });
});

describe("dynamic-schema: validateCustomFields (DB-backed field definitions)", () => {
  const createdDefinitionIds: string[] = [];

  afterAll(async () => {
    for (const id of createdDefinitionIds) {
      await db.delete(assetFieldDefinitions).where(eq(assetFieldDefinitions.assetDefinitionId, id));
    }
    for (const id of createdDefinitionIds) {
      await db.delete(assetDefinitions).where(eq(assetDefinitions.id, id));
    }
  });

  let definitionCounter = 0;

  async function makeDefinitionWithFields() {
    definitionCounter += 1;
    const def = await createAssetDefinition({ key: `${PREFIX}dynschema_${definitionCounter}`, name: "Dynamic schema fixture" });
    createdDefinitionIds.push(def.id);

    await db.insert(assetFieldDefinitions).values([
      {
        assetDefinitionId: def.id,
        key: "warranty_months",
        label: "Meses de garantía",
        fieldType: "number",
        isRequired: true,
      },
      {
        assetDefinitionId: def.id,
        key: "notes",
        label: "Notas",
        fieldType: "text",
        isRequired: false,
      },
      {
        assetDefinitionId: def.id,
        key: "is_leased",
        label: "¿Es arrendado?",
        fieldType: "boolean",
        isRequired: false,
      },
    ]);

    return def;
  }

  it("accepts a payload where every required field is present and correctly typed", async () => {
    const def = await makeDefinitionWithFields();
    const result = await validateCustomFields(def.id, { warranty_months: 12, notes: "ok", is_leased: false });
    expect(result).toEqual({ warranty_months: 12, notes: "ok", is_leased: false });
  });

  it("rejects when a required custom field is missing", async () => {
    const def = await makeDefinitionWithFields();
    await expect(validateCustomFields(def.id, { notes: "missing warranty_months" })).rejects.toThrow();
  });

  it("rejects when a required custom field has the wrong type (text where a number is expected)", async () => {
    const def = await makeDefinitionWithFields();
    await expect(validateCustomFields(def.id, { warranty_months: "twelve months" })).rejects.toThrow();
  });

  it("defaults missing/undefined customFields input to {} and still enforces required fields", async () => {
    const def = await makeDefinitionWithFields();
    await expect(validateCustomFields(def.id, undefined)).rejects.toThrow();
  });

  it("returns {} for a definition with no field definitions at all", async () => {
    const def = await createAssetDefinition({ key: `${PREFIX}nofields`, name: "Sin campos" });
    createdDefinitionIds.push(def.id);
    expect(await validateCustomFields(def.id, {})).toEqual({});
    expect(await validateCustomFields(def.id, undefined)).toEqual({});
  });
});
