import { db, ruleActions, ruleCriteria, rules, type Rule, type RuleAction, type RuleCriterion } from "@itsm/db";
import { and, asc, eq } from "drizzle-orm";

export async function createRule(input: {
  entityId: string;
  ruleType: string;
  name: string;
  ranking?: number;
  matchType?: "all" | "any";
  isActive?: boolean;
  stopOnMatch?: boolean;
}): Promise<Rule> {
  const [created] = await db
    .insert(rules)
    .values({
      entityId: input.entityId,
      ruleType: input.ruleType,
      name: input.name,
      ranking: input.ranking ?? 0,
      matchType: input.matchType ?? "all",
      isActive: input.isActive ?? true,
      stopOnMatch: input.stopOnMatch ?? false,
    })
    .returning();
  if (!created) throw new Error("Failed to insert rule");
  return created;
}

export async function listRules(ruleType: string, entityId: string): Promise<Rule[]> {
  return db
    .select()
    .from(rules)
    .where(and(eq(rules.ruleType, ruleType), eq(rules.entityId, entityId)))
    .orderBy(asc(rules.ranking));
}

export async function listRulesByEntity(entityId: string): Promise<Rule[]> {
  return db.select().from(rules).where(eq(rules.entityId, entityId)).orderBy(asc(rules.ruleType), asc(rules.ranking));
}

export async function getRule(id: string): Promise<Rule | undefined> {
  const [rule] = await db.select().from(rules).where(eq(rules.id, id));
  return rule;
}

export async function addRuleCriteria(input: {
  ruleId: string;
  field: string;
  operator: RuleCriterion["operator"];
  value: string;
}): Promise<RuleCriterion> {
  const [created] = await db.insert(ruleCriteria).values(input).returning();
  if (!created) throw new Error("Failed to insert rule criterion");
  return created;
}

export async function listRuleCriteria(ruleId: string): Promise<RuleCriterion[]> {
  return db.select().from(ruleCriteria).where(eq(ruleCriteria.ruleId, ruleId));
}

export async function addRuleAction(input: {
  ruleId: string;
  actionType: RuleAction["actionType"];
  field: string;
  value: string;
}): Promise<RuleAction> {
  const [created] = await db.insert(ruleActions).values(input).returning();
  if (!created) throw new Error("Failed to insert rule action");
  return created;
}

export async function listRuleActions(ruleId: string): Promise<RuleAction[]> {
  return db.select().from(ruleActions).where(eq(ruleActions.ruleId, ruleId));
}

function evaluateCriterion(criterion: RuleCriterion, input: Record<string, unknown>): boolean {
  const raw = input[criterion.field];
  const actual = raw === undefined || raw === null ? "" : String(raw);

  switch (criterion.operator) {
    case "is":
      return actual === criterion.value;
    case "contains":
      return actual.toLowerCase().includes(criterion.value.toLowerCase());
    case "regex_match":
      try {
        return new RegExp(criterion.value).test(actual);
      } catch {
        return false;
      }
    case "less_than":
      return Number(actual) < Number(criterion.value);
    case "greater_than":
      return Number(actual) > Number(criterion.value);
    case "date_before":
      return actual !== "" && new Date(actual).getTime() < new Date(criterion.value).getTime();
    case "date_after":
      return actual !== "" && new Date(actual).getTime() > new Date(criterion.value).getTime();
    default:
      return false;
  }
}

function applyAction(action: RuleAction, output: Record<string, unknown>): void {
  switch (action.actionType) {
    case "assign":
      output[action.field] = action.value;
      break;
    case "append": {
      const existing = output[action.field];
      output[action.field] = existing === undefined || existing === null ? action.value : `${String(existing)}${action.value}`;
      break;
    }
    case "regex_result": {
      // action.value holds a /pattern/replacement pair separated by the first unescaped "/"; kept simple on purpose.
      const separatorIndex = action.value.indexOf("/");
      if (separatorIndex === -1) break;
      const pattern = action.value.slice(0, separatorIndex);
      const replacement = action.value.slice(separatorIndex + 1);
      const source = output[action.field];
      if (typeof source === "string") {
        try {
          output[action.field] = source.replace(new RegExp(pattern), replacement);
        } catch {
          // Invalid pattern - leave the field untouched rather than throwing mid-evaluation.
        }
      }
      break;
    }
    case "stop_processing":
      break;
  }
}

/**
 * Loads active rules for `ruleType`+`entityId` (ranked), evaluates each one's
 * criteria against `input` (AND/OR per matchType), and for every match applies
 * its actions onto an accumulator that starts as a copy of `input` - mirrors
 * GLPI's chained input->output behavior without a separate "collection" class.
 * A rule with stopOnMatch=true (or a "stop_processing" action) halts evaluation.
 */
export async function evaluateRules(
  ruleType: string,
  entityId: string,
  input: Record<string, unknown>,
): Promise<{ output: Record<string, unknown>; matchedRuleIds: string[] }> {
  const activeRules = (await listRules(ruleType, entityId)).filter((r) => r.isActive);
  const output: Record<string, unknown> = { ...input };
  const matchedRuleIds: string[] = [];

  for (const rule of activeRules) {
    const criteria = await listRuleCriteria(rule.id);
    const matched =
      criteria.length === 0
        ? false
        : rule.matchType === "any"
          ? criteria.some((c) => evaluateCriterion(c, output))
          : criteria.every((c) => evaluateCriterion(c, output));

    if (!matched) continue;

    matchedRuleIds.push(rule.id);
    const actions = await listRuleActions(rule.id);
    let stop = rule.stopOnMatch;
    for (const action of actions) {
      applyAction(action, output);
      if (action.actionType === "stop_processing") stop = true;
    }
    if (stop) break;
  }

  return { output, matchedRuleIds };
}
