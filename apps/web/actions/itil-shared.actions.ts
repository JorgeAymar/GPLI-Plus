"use server";

import { requireAuthContext } from "@/lib/session";
import {
  RIGHT,
  addActor,
  addActorSchema,
  addCost,
  addCostSchema,
  addTimelineItem,
  addTimelineItemSchema,
  addValidation,
  addValidationSchema,
  assignSla,
  assignSlaSchema,
  moduleKeyForItilType,
  requireRight,
  respondToValidation,
  respondToValidationSchema,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function addActorAction(input: unknown) {
  const parsed = addActorSchema.parse(input);
  const context = await requireAuthContext();
  await requireRight(context, moduleKeyForItilType(parsed.itilType), RIGHT.ASSIGN);
  const actor = await addActor(parsed.itilType, parsed.itilId, parsed);
  revalidatePath(`/assistance/${parsed.itilType}s/${parsed.itilId}`);
  return actor;
}

export async function addTimelineItemAction(input: unknown) {
  const parsed = addTimelineItemSchema.parse(input);
  const context = await requireAuthContext();
  await requireRight(context, moduleKeyForItilType(parsed.itilType), RIGHT.UPDATE);
  const item = await addTimelineItem(parsed.itilType, parsed.itilId, { ...parsed, createdBy: context.user.id });
  revalidatePath(`/assistance/${parsed.itilType}s/${parsed.itilId}`);
  return item;
}

export async function addValidationAction(input: unknown) {
  const parsed = addValidationSchema.parse(input);
  const context = await requireAuthContext();
  await requireRight(context, moduleKeyForItilType(parsed.itilType), RIGHT.APPROVE);
  const validation = await addValidation(parsed.itilType, parsed.itilId, parsed);
  revalidatePath(`/assistance/${parsed.itilType}s/${parsed.itilId}`);
  return validation;
}

export async function respondToValidationAction(id: string, itilType: "ticket" | "problem" | "change", itilId: string, input: unknown) {
  const parsed = respondToValidationSchema.parse(input);
  const context = await requireAuthContext();
  await requireRight(context, moduleKeyForItilType(itilType), RIGHT.APPROVE);
  const validation = await respondToValidation(id, parsed.status, parsed.comment);
  revalidatePath(`/assistance/${itilType}s/${itilId}`);
  return validation;
}

export async function addCostAction(input: unknown) {
  const parsed = addCostSchema.parse(input);
  const context = await requireAuthContext();
  await requireRight(context, moduleKeyForItilType(parsed.itilType), RIGHT.UPDATE);
  const cost = await addCost(parsed.itilType, parsed.itilId, parsed);
  revalidatePath(`/assistance/${parsed.itilType}s/${parsed.itilId}`);
  return cost;
}

export async function assignSlaAction(input: unknown) {
  const parsed = assignSlaSchema.parse(input);
  const context = await requireAuthContext();
  await requireRight(context, moduleKeyForItilType(parsed.itilType), RIGHT.UPDATE);
  const assignment = await assignSla(parsed.itilType, parsed.itilId, parsed);
  revalidatePath(`/assistance/${parsed.itilType}s/${parsed.itilId}`);
  return assignment;
}
