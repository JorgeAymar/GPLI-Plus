import { z } from "zod";

export const createNotificationTemplateSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, "Solo minúsculas, dígitos y guión bajo"),
  name: z.string().min(1).max(255),
  subjectTemplate: z.string().min(1).max(500),
  bodyTemplate: z.string().min(1).max(10000),
});
export type CreateNotificationTemplateInput = z.infer<typeof createNotificationTemplateSchema>;
