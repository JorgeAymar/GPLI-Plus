import type { AssetFieldDefinition } from "@itsm/db";
import { z } from "zod";
import { listAssetFieldDefinitions } from "./asset-definition-service";

function baseZodForField(field: AssetFieldDefinition): z.ZodTypeAny {
  switch (field.fieldType) {
    case "text":
      return field.isRequired ? z.string().min(1, "Este campo es requerido").max(1000) : z.string().max(1000);
    case "textarea":
      return field.isRequired ? z.string().min(1, "Este campo es requerido").max(10000) : z.string().max(10000);
    case "number":
      return z.coerce.number();
    case "boolean":
      // Plain z.coerce.boolean() uses JS `Boolean(value)`, which has two bugs
      // for a dynamic form field: (1) ANY non-empty string coerces to `true`,
      // so the literal string "false" becomes boolean `true`; (2) `undefined`
      // coerces to `false`, so a required boolean field that's simply missing
      // silently "validates" instead of being rejected. Preprocess narrowly
      // instead: pass real booleans through untouched, accept the common
      // textual/numeric representations, and let anything else (including
      // undefined) fall through to z.boolean()'s normal type-check so a
      // missing required field still fails validation as expected.
      return z.preprocess((value) => {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") {
          if (value === 1) return true;
          if (value === 0) return false;
        }
        if (typeof value === "string") {
          const normalized = value.trim().toLowerCase();
          if (normalized === "true" || normalized === "1") return true;
          if (normalized === "false" || normalized === "0") return false;
        }
        return value;
      }, z.boolean());
    case "date":
      return z.coerce.date();
    case "dropdown":
      return z.string().uuid(); // references dropdown_items.id
  }
}

function zodForField(field: AssetFieldDefinition): z.ZodTypeAny {
  const base = baseZodForField(field);
  return field.isRequired ? base : base.nullable().optional();
}

/**
 * Builds a per-type Zod object schema from that type's field definitions.
 * `.strict()` rejects unknown keys, so a field definition deleted by an admin
 * can't leave orphaned junk silently accepted in future writes.
 */
export function buildDynamicSchema(fieldDefs: AssetFieldDefinition[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fieldDefs) shape[field.key] = zodForField(field);
  return z.object(shape).strict();
}

/** Fetches field defs for the type and validates+coerces raw custom_fields input against them. */
export async function validateCustomFields(assetDefinitionId: string, customFields: unknown): Promise<Record<string, unknown>> {
  const fieldDefs = await listAssetFieldDefinitions(assetDefinitionId);
  return buildDynamicSchema(fieldDefs).parse(customFields ?? {});
}
