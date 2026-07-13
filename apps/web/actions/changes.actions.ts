"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createChange,
  createChangeSchema,
  itilStatusSchema,
  requireRight,
  updateChange,
  updateChangeSchema,
  updateChangeStatus,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createChangeAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_CHANGE, RIGHT.CREATE);
  const parsed = createChangeSchema.parse(input);
  const change = await createChange(parsed, context.user.id);
  revalidatePath("/assistance/changes");
  return change;
}

export async function updateChangeAction(id: string, input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_CHANGE, RIGHT.UPDATE);
  const parsed = updateChangeSchema.parse(input);
  const change = await updateChange(id, parsed, context.user.id);
  revalidatePath(`/assistance/changes/${id}`);
  return change;
}

export async function updateChangeStatusAction(id: string, status: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_CHANGE, RIGHT.UPDATE);
  const parsedStatus = itilStatusSchema.parse(status);
  const change = await updateChangeStatus(id, parsedStatus, context.user.id);
  revalidatePath(`/assistance/changes/${id}`);
  return change;
}
