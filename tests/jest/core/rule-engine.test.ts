/**
 * Jest coverage for packages/core/src/rules/rule-engine.ts (the /setup/rules engine) -
 * previously zero direct test coverage (see
 * docs/superpowers/specs/2026-07-19-plan-de-pruebas.md §4.2). Runs against the same real dev
 * Postgres the Vitest suite uses; no mocks anywhere in this file.
 */
import { randomUUID } from "node:crypto";
import { like } from "drizzle-orm";
import { db, rules, type Entity } from "@itsm/db";
import {
  addRuleAction,
  addRuleCriteria,
  createRule,
  evaluateRules,
  getRule,
  listRuleActions,
  listRuleCriteria,
  listRules,
  listRulesByEntity,
} from "@itsm/core";
import { createTestEntity, deleteTestEntitiesByPrefix, PREFIX, uniqueSuffix } from "../support/fixtures";

/** Every rule created in this file is tagged via its `name`, so afterAll can find and delete
 * them (and their cascade-deleted criteria/actions) before the entity cleanup runs - `rules`
 * has a plain (no onDelete) FK to entities, so the entity delete would fail otherwise. */
async function deleteTestRulesByPrefix(): Promise<void> {
  await db.delete(rules).where(like(rules.name, `${PREFIX}%`));
}

describe("rule-engine", () => {
  let entity: Entity;

  beforeAll(async () => {
    entity = await createTestEntity();
  });

  afterAll(async () => {
    await deleteTestRulesByPrefix();
    await deleteTestEntitiesByPrefix();
  });

  describe("createRule / listRules / listRulesByEntity / getRule (CRUD)", () => {
    it("creates a rule with documented defaults when optional fields are omitted", async () => {
      const rule = await createRule({ entityId: entity.id, ruleType: `${PREFIX}_crud_${uniqueSuffix()}`, name: `${PREFIX}_crud` });
      expect(rule.ranking).toBe(0);
      expect(rule.matchType).toBe("all");
      expect(rule.isActive).toBe(true);
      expect(rule.stopOnMatch).toBe(false);
    });

    it("honors explicit overrides for every optional field", async () => {
      const rule = await createRule({
        entityId: entity.id,
        ruleType: `${PREFIX}_crud_${uniqueSuffix()}`,
        name: `${PREFIX}_crud_overrides`,
        ranking: 7,
        matchType: "any",
        isActive: false,
        stopOnMatch: true,
      });
      expect(rule.ranking).toBe(7);
      expect(rule.matchType).toBe("any");
      expect(rule.isActive).toBe(false);
      expect(rule.stopOnMatch).toBe(true);
    });

    it("listRules filters by both ruleType and entityId, ordered by ranking ascending", async () => {
      const ruleType = `${PREFIX}_list_${uniqueSuffix()}`;
      const otherEntity = await createTestEntity();

      const high = await createRule({ entityId: entity.id, ruleType, name: `${PREFIX}_list_high`, ranking: 10 });
      const low = await createRule({ entityId: entity.id, ruleType, name: `${PREFIX}_list_low`, ranking: 0 });
      const mid = await createRule({ entityId: entity.id, ruleType, name: `${PREFIX}_list_mid`, ranking: 5 });
      // Same ruleType, different entity - must not appear in listRules(ruleType, entity.id).
      await createRule({ entityId: otherEntity.id, ruleType, name: `${PREFIX}_list_other_entity` });
      // Same entity, different ruleType - must not appear either.
      await createRule({ entityId: entity.id, ruleType: `${PREFIX}_list_other_type_${uniqueSuffix()}`, name: `${PREFIX}_list_other_type` });

      const result = await listRules(ruleType, entity.id);
      expect(result.map((r) => r.id)).toEqual([low.id, mid.id, high.id]);
    });

    it("listRulesByEntity returns every rule for the entity across rule types, ordered by (ruleType, ranking)", async () => {
      const isolatedEntity = await createTestEntity();
      const typeA = `${PREFIX}_byentity_a_${uniqueSuffix()}`;
      const typeB = `${PREFIX}_byentity_b_${uniqueSuffix()}`;
      const a1 = await createRule({ entityId: isolatedEntity.id, ruleType: typeA, name: `${PREFIX}_a1`, ranking: 1 });
      const a0 = await createRule({ entityId: isolatedEntity.id, ruleType: typeA, name: `${PREFIX}_a0`, ranking: 0 });
      const b0 = await createRule({ entityId: isolatedEntity.id, ruleType: typeB, name: `${PREFIX}_b0`, ranking: 0 });

      const result = await listRulesByEntity(isolatedEntity.id);
      // typeA sorts before typeB lexicographically only because of the fixed prefix here, but
      // the real assertion is the ranking order *within* each ruleType group.
      const idsInTypeA = result.filter((r) => r.ruleType === typeA).map((r) => r.id);
      expect(idsInTypeA).toEqual([a0.id, a1.id]);
      expect(result.map((r) => r.id)).toContain(b0.id);
    });

    it("getRule returns undefined for an id that doesn't exist", async () => {
      await expect(getRule(randomUUID())).resolves.toBeUndefined();
    });
  });

  describe("addRuleCriteria / addRuleAction (CRUD)", () => {
    it("round-trips criteria and actions for a rule", async () => {
      const rule = await createRule({ entityId: entity.id, ruleType: `${PREFIX}_crit_${uniqueSuffix()}`, name: `${PREFIX}_crit` });
      const criterion = await addRuleCriteria({ ruleId: rule.id, field: "title", operator: "contains", value: "urgent" });
      const action = await addRuleAction({ ruleId: rule.id, actionType: "assign", field: "priority", value: "5" });

      await expect(listRuleCriteria(rule.id)).resolves.toEqual([criterion]);
      await expect(listRuleActions(rule.id)).resolves.toEqual([action]);
    });
  });

  describe("evaluateRules", () => {
    async function setupRule(overrides: {
      ruleType: string;
      name: string;
      ranking?: number;
      matchType?: "all" | "any";
      isActive?: boolean;
      stopOnMatch?: boolean;
      criteria?: Array<{ field: string; operator: Parameters<typeof addRuleCriteria>[0]["operator"]; value: string }>;
      actions?: Array<{ actionType: Parameters<typeof addRuleAction>[0]["actionType"]; field: string; value: string }>;
    }) {
      const rule = await createRule({
        entityId: entity.id,
        ruleType: overrides.ruleType,
        name: overrides.name,
        ranking: overrides.ranking,
        matchType: overrides.matchType,
        isActive: overrides.isActive,
        stopOnMatch: overrides.stopOnMatch,
      });
      for (const c of overrides.criteria ?? []) {
        await addRuleCriteria({ ruleId: rule.id, ...c });
      }
      for (const a of overrides.actions ?? []) {
        await addRuleAction({ ruleId: rule.id, ...a });
      }
      return rule;
    }

    it("a rule with zero criteria never matches, regardless of matchType", async () => {
      const ruleType = `${PREFIX}_nocriteria_${uniqueSuffix()}`;
      await setupRule({
        ruleType,
        name: `${PREFIX}_nocriteria`,
        matchType: "any",
        actions: [{ actionType: "assign", field: "flagged", value: "true" }],
      });

      const { output, matchedRuleIds } = await evaluateRules(ruleType, entity.id, { title: "anything" });
      expect(matchedRuleIds).toEqual([]);
      expect(output.flagged).toBeUndefined();
    });

    it("skips inactive rules entirely, even when their criteria would match", async () => {
      const ruleType = `${PREFIX}_inactive_${uniqueSuffix()}`;
      await setupRule({
        ruleType,
        name: `${PREFIX}_inactive`,
        isActive: false,
        criteria: [{ field: "title", operator: "is", value: "match me" }],
        actions: [{ actionType: "assign", field: "hit", value: "true" }],
      });

      const { output, matchedRuleIds } = await evaluateRules(ruleType, entity.id, { title: "match me" });
      expect(matchedRuleIds).toEqual([]);
      expect(output.hit).toBeUndefined();
    });

    it("evaluates rules in ranking order, not creation order", async () => {
      const ruleType = `${PREFIX}_order_${uniqueSuffix()}`;
      // Created out of ranking order on purpose.
      await setupRule({
        ruleType,
        name: `${PREFIX}_order_third`,
        ranking: 20,
        criteria: [{ field: "title", operator: "is", value: "x" }],
        actions: [{ actionType: "append", field: "trail", value: "C" }],
      });
      await setupRule({
        ruleType,
        name: `${PREFIX}_order_first`,
        ranking: 0,
        criteria: [{ field: "title", operator: "is", value: "x" }],
        actions: [{ actionType: "append", field: "trail", value: "A" }],
      });
      await setupRule({
        ruleType,
        name: `${PREFIX}_order_second`,
        ranking: 10,
        criteria: [{ field: "title", operator: "is", value: "x" }],
        actions: [{ actionType: "append", field: "trail", value: "B" }],
      });

      const { output } = await evaluateRules(ruleType, entity.id, { title: "x" });
      expect(output.trail).toBe("ABC");
    });

    describe("matchType: all vs any", () => {
      it("matchType=all requires every criterion to match", async () => {
        const ruleType = `${PREFIX}_all_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_all`,
          matchType: "all",
          criteria: [
            { field: "title", operator: "contains", value: "urgent" },
            { field: "urgency", operator: "greater_than", value: "3" },
          ],
          actions: [{ actionType: "assign", field: "escalated", value: "true" }],
        });

        const partial = await evaluateRules(ruleType, entity.id, { title: "urgent request", urgency: 2 });
        expect(partial.matchedRuleIds).toEqual([]);

        const full = await evaluateRules(ruleType, entity.id, { title: "urgent request", urgency: 4 });
        expect(full.matchedRuleIds).toHaveLength(1);
        expect(full.output.escalated).toBe("true");
      });

      it("matchType=any requires only one criterion to match", async () => {
        const ruleType = `${PREFIX}_any_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_any`,
          matchType: "any",
          criteria: [
            { field: "title", operator: "contains", value: "urgent" },
            { field: "urgency", operator: "greater_than", value: "3" },
          ],
          actions: [{ actionType: "assign", field: "escalated", value: "true" }],
        });

        const result = await evaluateRules(ruleType, entity.id, { title: "normal request", urgency: 4 });
        expect(result.matchedRuleIds).toHaveLength(1);
        expect(result.output.escalated).toBe("true");

        const noMatch = await evaluateRules(ruleType, entity.id, { title: "normal request", urgency: 1 });
        expect(noMatch.matchedRuleIds).toEqual([]);
      });
    });

    describe("criteria operators", () => {
      it.each([
        ["is", "new", "new", true],
        ["is", "new", "assigned", false],
        ["contains", "URGENT request", "urgent", true],
        ["contains", "URGENT request", "billing", false],
        ["less_than", "3", "5", true],
        ["less_than", "5", "3", false],
        ["greater_than", "5", "3", true],
        ["greater_than", "3", "5", false],
      ] as const)("operator=%s: field value %j vs criterion value %j -> %s", async (operator, fieldValue, criterionValue, expectMatch) => {
        const ruleType = `${PREFIX}_op_${operator}_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_op_${operator}`,
          criteria: [{ field: "value", operator, value: criterionValue }],
          actions: [{ actionType: "assign", field: "matched", value: "true" }],
        });

        const { matchedRuleIds } = await evaluateRules(ruleType, entity.id, { value: fieldValue });
        expect(matchedRuleIds.length > 0).toBe(expectMatch);
      });

      it("regex_match: matches a valid pattern and is false (not throwing) for an invalid one", async () => {
        const ruleType = `${PREFIX}_regexmatch_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_regexmatch_valid`,
          criteria: [{ field: "title", operator: "regex_match", value: "^INC-\\d+$" }],
          actions: [{ actionType: "assign", field: "matched", value: "true" }],
        });
        const invalidRuleType = `${PREFIX}_regexmatch_invalid_${uniqueSuffix()}`;
        await setupRule({
          ruleType: invalidRuleType,
          name: `${PREFIX}_regexmatch_invalid`,
          // Unterminated character class - an invalid JS regex.
          criteria: [{ field: "title", operator: "regex_match", value: "[" }],
          actions: [{ actionType: "assign", field: "matched", value: "true" }],
        });

        const matched = await evaluateRules(ruleType, entity.id, { title: "INC-1234" });
        expect(matched.matchedRuleIds).toHaveLength(1);

        const notMatched = await evaluateRules(ruleType, entity.id, { title: "INC-abc" });
        expect(notMatched.matchedRuleIds).toEqual([]);

        await expect(evaluateRules(invalidRuleType, entity.id, { title: "anything" })).resolves.toEqual({
          output: { title: "anything" },
          matchedRuleIds: [],
        });
      });

      it("date_before / date_after: missing field and invalid dates both evaluate to false rather than throwing", async () => {
        const beforeType = `${PREFIX}_datebefore_${uniqueSuffix()}`;
        await setupRule({
          ruleType: beforeType,
          name: `${PREFIX}_datebefore`,
          criteria: [{ field: "dueDate", operator: "date_before", value: "2030-01-01" }],
          actions: [{ actionType: "assign", field: "matched", value: "true" }],
        });

        const matches = await evaluateRules(beforeType, entity.id, { dueDate: "2020-01-01" });
        expect(matches.matchedRuleIds).toHaveLength(1);

        const missingField = await evaluateRules(beforeType, entity.id, {});
        expect(missingField.matchedRuleIds).toEqual([]);

        const invalidDate = await evaluateRules(beforeType, entity.id, { dueDate: "not-a-date" });
        expect(invalidDate.matchedRuleIds).toEqual([]);

        const afterType = `${PREFIX}_dateafter_${uniqueSuffix()}`;
        await setupRule({
          ruleType: afterType,
          name: `${PREFIX}_dateafter`,
          criteria: [{ field: "dueDate", operator: "date_after", value: "2020-01-01" }],
          actions: [{ actionType: "assign", field: "matched", value: "true" }],
        });
        const afterMatches = await evaluateRules(afterType, entity.id, { dueDate: "2030-01-01" });
        expect(afterMatches.matchedRuleIds).toHaveLength(1);
      });

      it("treats a missing input field as an empty string, not undefined/null", async () => {
        const ruleType = `${PREFIX}_missingfield_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_missingfield`,
          criteria: [{ field: "doesNotExist", operator: "is", value: "" }],
          actions: [{ actionType: "assign", field: "matched", value: "true" }],
        });

        const { matchedRuleIds } = await evaluateRules(ruleType, entity.id, { title: "irrelevant" });
        expect(matchedRuleIds).toHaveLength(1);
      });
    });

    describe("actions", () => {
      it("assign overwrites the field unconditionally", async () => {
        const ruleType = `${PREFIX}_assign_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_assign`,
          criteria: [{ field: "title", operator: "is", value: "x" }],
          actions: [{ actionType: "assign", field: "priority", value: "urgent" }],
        });

        const { output } = await evaluateRules(ruleType, entity.id, { title: "x", priority: "low" });
        expect(output.priority).toBe("urgent");
      });

      it("append concatenates onto an existing value and assigns plainly when the field was unset", async () => {
        const ruleType = `${PREFIX}_append_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_append`,
          criteria: [{ field: "title", operator: "is", value: "x" }],
          actions: [
            { actionType: "append", field: "tags", value: "-urgent" },
            { actionType: "append", field: "brandNew", value: "seed" },
          ],
        });

        const { output } = await evaluateRules(ruleType, entity.id, { title: "x", tags: "incident" });
        expect(output.tags).toBe("incident-urgent");
        expect(output.brandNew).toBe("seed");
      });

      it("regex_result rewrites a string field via pattern/replacement, is a no-op with no separator or a non-string field, and swallows invalid patterns", async () => {
        const ruleType = `${PREFIX}_regexresult_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_regexresult`,
          criteria: [{ field: "title", operator: "is", value: "x" }],
          actions: [
            { actionType: "regex_result", field: "code", value: "^INC-/TICKET-" },
            { actionType: "regex_result", field: "noSeparator", value: "no-slash-here" },
            { actionType: "regex_result", field: "numericField", value: "^1/2" },
            { actionType: "regex_result", field: "badPattern", value: "[/x" },
          ],
        });

        const { output } = await evaluateRules(ruleType, entity.id, {
          title: "x",
          code: "INC-42",
          noSeparator: "untouched",
          numericField: 1,
          badPattern: "left-alone",
        });
        expect(output.code).toBe("TICKET-42");
        expect(output.noSeparator).toBe("untouched");
        expect(output.numericField).toBe(1);
        expect(output.badPattern).toBe("left-alone");
      });

      it("stop_processing halts evaluation of subsequent rules even when the matching rule's own stopOnMatch is false", async () => {
        const ruleType = `${PREFIX}_stopaction_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_stopaction_first`,
          ranking: 0,
          stopOnMatch: false,
          criteria: [{ field: "title", operator: "is", value: "x" }],
          actions: [
            { actionType: "assign", field: "seenFirst", value: "true" },
            { actionType: "stop_processing", field: "n/a", value: "n/a" },
          ],
        });
        await setupRule({
          ruleType,
          name: `${PREFIX}_stopaction_second`,
          ranking: 10,
          criteria: [{ field: "title", operator: "is", value: "x" }],
          actions: [{ actionType: "assign", field: "seenSecond", value: "true" }],
        });

        const { output, matchedRuleIds } = await evaluateRules(ruleType, entity.id, { title: "x" });
        expect(output.seenFirst).toBe("true");
        expect(output.seenSecond).toBeUndefined();
        expect(matchedRuleIds).toHaveLength(1);
      });

      it("a rule's own stopOnMatch=true halts evaluation of subsequent rules after it matches", async () => {
        const ruleType = `${PREFIX}_stoprule_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_stoprule_first`,
          ranking: 0,
          stopOnMatch: true,
          criteria: [{ field: "title", operator: "is", value: "x" }],
          actions: [{ actionType: "assign", field: "seenFirst", value: "true" }],
        });
        await setupRule({
          ruleType,
          name: `${PREFIX}_stoprule_second`,
          ranking: 10,
          criteria: [{ field: "title", operator: "is", value: "x" }],
          actions: [{ actionType: "assign", field: "seenSecond", value: "true" }],
        });

        const { output, matchedRuleIds } = await evaluateRules(ruleType, entity.id, { title: "x" });
        expect(output.seenFirst).toBe("true");
        expect(output.seenSecond).toBeUndefined();
        expect(matchedRuleIds).toHaveLength(1);
      });

      it("without stopOnMatch or a stop_processing action, every matching rule runs and later rules see earlier rules' output", async () => {
        const ruleType = `${PREFIX}_chain_${uniqueSuffix()}`;
        await setupRule({
          ruleType,
          name: `${PREFIX}_chain_first`,
          ranking: 0,
          criteria: [{ field: "title", operator: "is", value: "x" }],
          actions: [{ actionType: "assign", field: "priority", value: "5" }],
        });
        // This rule's criterion only matches if it can see the *output* of the first rule,
        // not just the original input - proves the chained input->output accumulator.
        await setupRule({
          ruleType,
          name: `${PREFIX}_chain_second`,
          ranking: 10,
          criteria: [{ field: "priority", operator: "is", value: "5" }],
          actions: [{ actionType: "assign", field: "escalated", value: "true" }],
        });

        const { output, matchedRuleIds } = await evaluateRules(ruleType, entity.id, { title: "x" });
        expect(matchedRuleIds).toHaveLength(2);
        expect(output.priority).toBe("5");
        expect(output.escalated).toBe("true");
      });
    });

    it("returns the input unchanged (copied, not mutated in place) when no rule matches", async () => {
      const ruleType = `${PREFIX}_nomatch_${uniqueSuffix()}`;
      await setupRule({
        ruleType,
        name: `${PREFIX}_nomatch`,
        criteria: [{ field: "title", operator: "is", value: "never-matches-this" }],
        actions: [{ actionType: "assign", field: "hit", value: "true" }],
      });

      const input = { title: "something else" };
      const { output, matchedRuleIds } = await evaluateRules(ruleType, entity.id, input);
      expect(matchedRuleIds).toEqual([]);
      expect(output).toEqual(input);
      expect(output).not.toBe(input);
    });
  });
});
