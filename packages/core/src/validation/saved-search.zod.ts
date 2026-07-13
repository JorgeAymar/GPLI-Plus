import { z } from "zod";

/**
 * v1 simplification: `queryJson` is an opaque blob (no generic search-engine
 * schema to validate against - see saved-search-service.ts). The web form
 * takes it in as raw JSON text and JSON.parse()s it before this schema runs.
 */
export const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(255),
  itemType: z.string().min(1).max(100),
  ownerUserId: z.string().uuid(),
  isPrivate: z.boolean().optional(),
  entityId: z.string().uuid(),
  isRecursive: z.boolean().optional(),
  queryJson: z.record(z.string(), z.unknown()).optional(),
  type: z.enum(["bookmark", "alert"]).optional(),
  doCount: z.enum(["no", "yes", "auto"]).optional(),
});
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;

export const createSavedSearchAlertSchema = z.object({
  savedSearchId: z.string().uuid(),
  operator: z.enum(["lt", "lte", "eq", "gt", "gte", "neq"]),
  thresholdValue: z.number().int(),
  frequencyMinutes: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});
export type CreateSavedSearchAlertInput = z.infer<typeof createSavedSearchAlertSchema>;
