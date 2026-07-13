import { z } from "zod";

export const ruleMatchTypeSchema = z.enum(["all", "any"]);
export const ruleCriteriaOperatorSchema = z.enum([
  "is",
  "contains",
  "regex_match",
  "less_than",
  "greater_than",
  "date_before",
  "date_after",
]);
export const ruleActionTypeSchema = z.enum(["assign", "append", "regex_result", "stop_processing"]);

export const createRuleSchema = z.object({
  entityId: z.string().uuid(),
  ruleType: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  ranking: z.number().int().optional(),
  matchType: ruleMatchTypeSchema.optional(),
  isActive: z.boolean().optional(),
  stopOnMatch: z.boolean().optional(),
});
export type CreateRuleInput = z.infer<typeof createRuleSchema>;

export const addRuleCriteriaSchema = z.object({
  ruleId: z.string().uuid(),
  field: z.string().min(1).max(100),
  operator: ruleCriteriaOperatorSchema,
  value: z.string().min(1).max(1000),
});
export type AddRuleCriteriaInput = z.infer<typeof addRuleCriteriaSchema>;

export const addRuleActionSchema = z.object({
  ruleId: z.string().uuid(),
  actionType: ruleActionTypeSchema,
  field: z.string().min(1).max(100),
  value: z.string().min(1).max(1000),
});
export type AddRuleActionInput = z.infer<typeof addRuleActionSchema>;
