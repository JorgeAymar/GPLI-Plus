import { db, ticketFieldDefinitions, type TicketFieldDefinition, type TicketFieldType } from "@itsm/db";
import { eq, isNull, or } from "drizzle-orm";
import { z } from "zod";

export async function createTicketFieldDefinition(input: {
  ticketType?: string | null;
  key: string;
  label: string;
  fieldType: TicketFieldType;
  dropdownCategoryId?: string | null;
  isRequired?: boolean;
  sortOrder?: number;
}): Promise<TicketFieldDefinition> {
  const [created] = await db
    .insert(ticketFieldDefinitions)
    .values({
      ticketType: input.ticketType ?? null,
      key: input.key,
      label: input.label,
      fieldType: input.fieldType,
      dropdownCategoryId: input.dropdownCategoryId ?? null,
      isRequired: input.isRequired ?? false,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  if (!created) throw new Error("Failed to insert ticket field definition");
  return created;
}

/**
 * Fields that apply to `ticketType` (exact match) plus fields that apply to both types
 * (ticketType IS NULL). Omit the argument to fetch every field definition regardless of type
 * (e.g. for a Setup listing screen).
 */
export async function listTicketFieldDefinitions(ticketType?: string): Promise<TicketFieldDefinition[]> {
  if (!ticketType) {
    return db.select().from(ticketFieldDefinitions).orderBy(ticketFieldDefinitions.sortOrder);
  }
  return db
    .select()
    .from(ticketFieldDefinitions)
    .where(or(eq(ticketFieldDefinitions.ticketType, ticketType), isNull(ticketFieldDefinitions.ticketType)))
    .orderBy(ticketFieldDefinitions.sortOrder);
}

function baseZodForField(field: TicketFieldDefinition): z.ZodTypeAny {
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

function zodForField(field: TicketFieldDefinition): z.ZodTypeAny {
  const base = baseZodForField(field);
  return field.isRequired ? base : base.nullable().optional();
}

/**
 * Builds a Zod object schema from a set of ticket field definitions - same pattern as
 * buildDynamicSchema() in assets/dynamic-schema.ts, kept as a separate parallel implementation
 * rather than a shared cross-domain abstraction (see that file's header comment).
 * `.strict()` rejects unknown keys, so a field definition deleted by an admin can't leave
 * orphaned junk silently accepted in future writes.
 */
export function buildTicketDynamicSchema(fieldDefs: TicketFieldDefinition[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fieldDefs) shape[field.key] = zodForField(field);
  return z.object(shape).strict();
}

/** Fetches field defs applicable to `ticketType` and validates+coerces raw custom_fields input against them. */
export async function validateTicketCustomFields(ticketType: string, customFields: unknown): Promise<Record<string, unknown>> {
  const fieldDefs = await listTicketFieldDefinitions(ticketType);
  return buildTicketDynamicSchema(fieldDefs).parse(customFields ?? {});
}
