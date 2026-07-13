import { z } from "zod";
import { ticketTypeSchema } from "./ticket.zod";

export const ticketFieldTypeSchema = z.enum(["text", "textarea", "number", "boolean", "date", "dropdown"]);

export const createTicketFieldDefinitionSchema = z.object({
  // null/omitted = applies to both "incident" and "request" (see ticket-field-definitions.ts).
  ticketType: ticketTypeSchema.nullable().optional(),
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, dígitos y guión bajo"),
  label: z.string().min(1).max(255),
  fieldType: ticketFieldTypeSchema,
  dropdownCategoryId: z.string().uuid().nullable().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateTicketFieldDefinitionInput = z.infer<typeof createTicketFieldDefinitionSchema>;
