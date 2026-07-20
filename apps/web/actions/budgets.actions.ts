"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createBudget, createBudgetSchema, recordAuditLog, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createBudgetAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_BUDGET, RIGHT.CREATE);
  const parsed = createBudgetSchema.parse(input);
  const budget = await createBudget(parsed);
  await recordAuditLog({
    entityId: budget.entityId,
    actorUserId: context.user.id,
    action: "create",
    objectType: "budget",
    objectId: budget.id,
    after: budget,
  });
  revalidatePath("/management/budgets");
  return budget;
}
