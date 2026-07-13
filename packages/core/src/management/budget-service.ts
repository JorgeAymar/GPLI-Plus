import { budgets, db, type Budget } from "@itsm/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

export async function createBudget(input: {
  entityId: string;
  name: string;
  amountCents: number;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  comment?: string | null;
}): Promise<Budget> {
  const [created] = await db
    .insert(budgets)
    .values({
      entityId: input.entityId,
      name: input.name,
      amountCents: input.amountCents,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert budget");
  return created;
}

export async function getBudget(id: string): Promise<Budget | undefined> {
  const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
  return row;
}

export async function listBudgets(entityId: string, options?: { includeSubtree?: boolean }): Promise<Budget[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(budgets)
    .where(and(inArray(budgets.entityId, entityIds), isNull(budgets.deletedAt)))
    .orderBy(budgets.name);
}
