import { z } from "zod";

export const createDropdownCategorySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, "Solo minúsculas, dígitos y guión bajo"),
  name: z.string().min(1).max(255),
  isSystem: z.boolean().optional(),
});
export type CreateDropdownCategoryInput = z.infer<typeof createDropdownCategorySchema>;

export const createDropdownItemSchema = z.object({
  categoryId: z.string().uuid(),
  entityId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  comment: z.string().max(1000).nullable().optional(),
});
export type CreateDropdownItemInput = z.infer<typeof createDropdownItemSchema>;
