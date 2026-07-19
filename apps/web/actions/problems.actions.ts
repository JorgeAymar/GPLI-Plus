"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createProblem,
  createProblemSchema,
  getProblem,
  itilStatusSchema,
  requireRight,
  requireRightOnEntity,
  updateProblem,
  updateProblemSchema,
  updateProblemStatus,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createProblemAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_PROBLEM, RIGHT.CREATE);
  const parsed = createProblemSchema.parse(input);
  const problem = await createProblem(parsed, context.user.id);
  revalidatePath("/assistance/problems");
  return problem;
}

/** See requireTicketRight in tickets.actions.ts for why this checks the problem's own entity. */
async function requireProblemRight(id: string, required: number) {
  const context = await requireAuthContext();
  const problem = await getProblem(id);
  if (!problem) throw new Error(`Problem ${id} not found`);
  await requireRightOnEntity(context, MODULE.ASSISTANCE_PROBLEM, required, problem.entityId);
  return context;
}

export async function updateProblemAction(id: string, input: unknown) {
  const context = await requireProblemRight(id, RIGHT.UPDATE);
  const parsed = updateProblemSchema.parse(input);
  const problem = await updateProblem(id, parsed, context.user.id);
  revalidatePath(`/assistance/problems/${id}`);
  return problem;
}

export async function updateProblemStatusAction(id: string, status: unknown) {
  const context = await requireProblemRight(id, RIGHT.UPDATE);
  const parsedStatus = itilStatusSchema.parse(status);
  const problem = await updateProblemStatus(id, parsedStatus, context.user.id);
  revalidatePath(`/assistance/problems/${id}`);
  return problem;
}
