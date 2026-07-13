import { z } from "zod";

export const createRssFeedSchema = z.object({
  name: z.string().min(1).max(255),
  ownerUserId: z.string().uuid(),
  url: z.string().url(),
  refreshRateMinutes: z.number().int().positive().optional(),
  maxItems: z.number().int().positive().max(100).optional(),
});
export type CreateRssFeedInput = z.infer<typeof createRssFeedSchema>;
