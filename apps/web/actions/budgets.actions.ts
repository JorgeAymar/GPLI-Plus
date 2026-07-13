"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createBudget, createBudgetSchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createBudgetAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_BUDGET, RIGHT.CREATE);
  const parsed = createBudgetSchema.parse(input);
  const budget = await createBudget(parsed);
  revalidatePath("/management/budgets");
  return budget;
}
