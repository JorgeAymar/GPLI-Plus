import { z } from "zod";

export const itilTypeSchema = z.enum(["ticket", "problem", "change"]);

export const addActorSchema = z.object({
  itilType: itilTypeSchema,
  itilId: z.string().uuid(),
  actorRole: z.enum(["requester", "assignee", "observer"]),
  actorKind: z.enum(["user", "group", "supplier"]),
  actorId: z.string().uuid(),
});
export type AddActorInput = z.infer<typeof addActorSchema>;

export const addTimelineItemSchema = z.object({
  itilType: itilTypeSchema,
  itilId: z.string().uuid(),
  itemType: z.enum(["followup", "task", "solution", "internal_note"]),
  content: z.string().min(1).max(20000),
  isPrivate: z.boolean().optional(),
  timeSpentMinutes: z.number().int().min(0).nullable().optional(),
});
export type AddTimelineItemInput = z.infer<typeof addTimelineItemSchema>;

export const addValidationSchema = z.object({
  itilType: itilTypeSchema,
  itilId: z.string().uuid(),
  validatorKind: z.enum(["user", "group"]),
  validatorId: z.string().uuid(),
  comment: z.string().max(2000).nullable().optional(),
});
export type AddValidationInput = z.infer<typeof addValidationSchema>;

export const respondToValidationSchema = z.object({
  status: z.enum(["approved", "refused"]),
  comment: z.string().max(2000).nullable().optional(),
});
export type RespondToValidationInput = z.infer<typeof respondToValidationSchema>;

export const addCostSchema = z.object({
  itilType: itilTypeSchema,
  itilId: z.string().uuid(),
  costType: z.string().min(1).max(100),
  amountCents: z.number().int().min(0),
  budgetId: z.string().uuid().nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type AddCostInput = z.infer<typeof addCostSchema>;
