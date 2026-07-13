"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createSavedSearch,
  createSavedSearchAlert,
  createSavedSearchAlertSchema,
  createSavedSearchSchema,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createSavedSearchAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_SAVED_SEARCH, RIGHT.CREATE);
  const parsed = createSavedSearchSchema.parse(input);
  const savedSearch = await createSavedSearch(parsed);
  revalidatePath("/tools/saved-searches");
  return savedSearch;
}

export async function createSavedSearchAlertAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_SAVED_SEARCH, RIGHT.CREATE);
  const parsed = createSavedSearchAlertSchema.parse(input);
  const alert = await createSavedSearchAlert(parsed);
  revalidatePath("/tools/saved-searches");
  return alert;
}
