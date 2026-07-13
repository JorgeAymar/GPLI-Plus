import { z } from "zod";

export const assetFieldTypeSchema = z.enum(["text", "textarea", "number", "boolean", "date", "dropdown"]);

export const createAssetDefinitionSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, "Solo minúsculas, dígitos y guión bajo"),
  name: z.string().min(1).max(255),
  icon: z.string().max(255).nullable().optional(),
  isSystem: z.boolean().optional(),
  hasExtensionTable: z.boolean().optional(),
});
export type CreateAssetDefinitionInput = z.infer<typeof createAssetDefinitionSchema>;

export const createAssetFieldDefinitionSchema = z.object({
  assetDefinitionId: z.string().uuid(),
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, dígitos y guión bajo"),
  label: z.string().min(1).max(255),
  fieldType: assetFieldTypeSchema,
  dropdownCategoryId: z.string().uuid().nullable().optional(),
  isRequired: z.boolean().optional(),
  defaultValue: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateAssetFieldDefinitionInput = z.infer<typeof createAssetFieldDefinitionSchema>;
