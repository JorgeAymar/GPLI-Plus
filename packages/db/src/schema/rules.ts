import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";

export const ruleMatchTypeEnum = pgEnum("rule_match_type", ["all", "any"]);
export type RuleMatchType = (typeof ruleMatchTypeEnum.enumValues)[number];

export const ruleCriteriaOperatorEnum = pgEnum("rule_criteria_operator", [
  "is",
  "contains",
  "regex_match",
  "less_than",
  "greater_than",
  "date_before",
  "date_after",
]);
export type RuleCriteriaOperator = (typeof ruleCriteriaOperatorEnum.enumValues)[number];

export const ruleActionTypeEnum = pgEnum("rule_action_type", ["assign", "append", "regex_result", "stop_processing"]);
export type RuleActionType = (typeof ruleActionTypeEnum.enumValues)[number];

/**
 * Generic rule engine reused across domains (ticket auto-assignment, asset
 * import matching, LDAP right assignment, ...) - `ruleType` is a free string
 * (like MODULE keys), not an enum, so a new domain never needs a migration.
 * Each domain defines its own `field` vocabulary for criteria/actions.
 */
export const rules = pgTable(
  "rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    ruleType: text("rule_type").notNull(),
    name: text("name").notNull(),
    ranking: integer("ranking").notNull().default(0),
    matchType: ruleMatchTypeEnum("match_type").notNull().default("all"),
    isActive: boolean("is_active").notNull().default(true),
    stopOnMatch: boolean("stop_on_match").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("rules_entity_idx").on(table.entityId)],
);

export const ruleCriteria = pgTable(
  "rule_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    operator: ruleCriteriaOperatorEnum("operator").notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("rule_criteria_rule_idx").on(table.ruleId)],
);

export const ruleActions = pgTable(
  "rule_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    actionType: ruleActionTypeEnum("action_type").notNull(),
    field: text("field").notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("rule_actions_rule_idx").on(table.ruleId)],
);

export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
export type RuleCriterion = typeof ruleCriteria.$inferSelect;
export type NewRuleCriterion = typeof ruleCriteria.$inferInsert;
export type RuleAction = typeof ruleActions.$inferSelect;
export type NewRuleAction = typeof ruleActions.$inferInsert;
