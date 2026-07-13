"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  addRuleAction,
  addRuleActionSchema,
  addRuleCriteria,
  addRuleCriteriaSchema,
  createRule,
  createRuleSchema,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createRuleAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_RULE, RIGHT.CREATE);
  const parsed = createRuleSchema.parse(input);
  const rule = await createRule(parsed);
  revalidatePath("/setup/rules");
  return rule;
}

export async function addRuleCriteriaAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_RULE, RIGHT.UPDATE);
  const parsed = addRuleCriteriaSchema.parse(input);
  const criterion = await addRuleCriteria(parsed);
  revalidatePath(`/setup/rules/${parsed.ruleId}`);
  return criterion;
}

export async function addRuleActionAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_RULE, RIGHT.UPDATE);
  const parsed = addRuleActionSchema.parse(input);
  const action = await addRuleAction(parsed);
  revalidatePath(`/setup/rules/${parsed.ruleId}`);
  return action;
}
