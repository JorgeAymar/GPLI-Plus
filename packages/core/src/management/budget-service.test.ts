import "dotenv/config";
import { budgets, db, entities, type Entity } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createBudget, getBudget, listBudgets } from "./budget-service";

const PREFIX = "__vitest_mgmt__budget-service";

describe("budget-service", () => {
  let rootEntity: Entity;
  let childEntity: Entity;
  const budgetIds: string[] = [];

  beforeAll(async () => {
    rootEntity = await createEntity({ name: `${PREFIX}-root` });
    childEntity = await createEntity({ name: `${PREFIX}-child`, parentId: rootEntity.id });
  });

  afterAll(async () => {
    if (budgetIds.length) await db.delete(budgets).where(inArray(budgets.id, budgetIds));
    await db.delete(entities).where(eq(entities.id, childEntity.id));
    await db.delete(entities).where(eq(entities.id, rootEntity.id));
  });

  it("creates a budget with minimal input and defaults null dates/comment", async () => {
    const budget = await createBudget({ entityId: rootEntity.id, name: `${PREFIX}-minimal`, amountCents: 250000 });
    budgetIds.push(budget.id);

    expect(budget.amountCents).toBe(250000);
    expect(budget.startDate).toBeNull();
    expect(budget.endDate).toBeNull();
    expect(budget.comment).toBeNull();
    expect(budget.deletedAt).toBeNull();

    const fetched = await getBudget(budget.id);
    expect(fetched?.id).toBe(budget.id);
  });

  it("coerces start/end date strings to Date instances", async () => {
    const budget = await createBudget({
      entityId: rootEntity.id,
      name: `${PREFIX}-dated`,
      amountCents: 100000,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      comment: "FY2026 IT budget",
    });
    budgetIds.push(budget.id);

    expect(budget.startDate).toBeInstanceOf(Date);
    expect(budget.endDate).toBeInstanceOf(Date);
    expect(budget.comment).toBe("FY2026 IT budget");
  });

  it("returns undefined from getBudget for a non-existent id", async () => {
    const fetched = await getBudget("00000000-0000-0000-0000-000000000000");
    expect(fetched).toBeUndefined();
  });

  it("scopes listBudgets to the given entity by default, and includes the subtree when asked", async () => {
    const rootBudget = await createBudget({ entityId: rootEntity.id, name: `${PREFIX}-root-budget`, amountCents: 1000 });
    const childBudget = await createBudget({ entityId: childEntity.id, name: `${PREFIX}-child-budget`, amountCents: 2000 });
    budgetIds.push(rootBudget.id, childBudget.id);

    const rootOnly = await listBudgets(rootEntity.id);
    expect(rootOnly.map((b) => b.id)).toContain(rootBudget.id);
    expect(rootOnly.map((b) => b.id)).not.toContain(childBudget.id);

    const withSubtree = await listBudgets(rootEntity.id, { includeSubtree: true });
    expect(withSubtree.map((b) => b.id)).toContain(rootBudget.id);
    expect(withSubtree.map((b) => b.id)).toContain(childBudget.id);
  });

  it("excludes soft-deleted budgets (deletedAt set) from listBudgets", async () => {
    const budget = await createBudget({ entityId: rootEntity.id, name: `${PREFIX}-soft-deleted`, amountCents: 500 });
    budgetIds.push(budget.id);

    // budget-service has no softDelete* export (unlike supplier/contact) - exercise the
    // deletedAt filter in listBudgets directly against the column it reads.
    await db.update(budgets).set({ deletedAt: new Date() }).where(eq(budgets.id, budget.id));

    const list = await listBudgets(rootEntity.id);
    expect(list.map((b) => b.id)).not.toContain(budget.id);
  });
});
