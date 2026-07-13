import { z } from "zod";

export const createWebhookSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  itemType: z.string().min(1).max(100),
  event: z.enum(["create", "update", "delete"]),
  url: z.string().url(),
  secret: z.string().min(8),
  customHeaders: z.record(z.string(), z.string()).optional(),
  maxRetries: z.number().int().min(1).optional(),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
