import type { AssetFieldDefinition } from "@itsm/db";
import { z } from "zod";
import { listAssetFieldDefinitions } from "./asset-definition-service";

function baseZodForField(field: AssetFieldDefinition): z.ZodTypeAny {
  switch (field.fieldType) {
    case "text":
      return z.string().max(1000);
    case "textarea":
      return z.string().max(10000);
    case "number":
      return z.coerce.number();
    case "boolean":
      return z.coerce.boolean();
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
