"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createDropdownCategory,
  createDropdownCategorySchema,
  createDropdownItem,
  createDropdownItemSchema,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * `schema.parse()` throws a `ZodError` whose `.message` getter is a JSON blob
 * (see zod's ZodError#message), not a human-readable string. Every setup form
 * surfaces server-action errors via `err.message`, so parsing this way turns
 * validation failures into unreadable JSON dumped in the UI. Use `.safeParse`
 * instead and rethrow a clean, semicolon-joined message.
 */
function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

export async function createDropdownCategoryAction(input: { key: string; name: string; isSystem?: boolean }) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_DROPDOWN, RIGHT.CREATE);
  const parsed = parseInput(createDropdownCategorySchema, input);
  const category = await createDropdownCategory(parsed);
  revalidatePath("/setup/dropdowns");
  return category;
}

export async function createDropdownItemAction(input: {
  categoryId: string;
  entityId: string;
  parentId?: string | null;
  name: string;
  comment?: string | null;
}) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_DROPDOWN, RIGHT.CREATE);
  const parsed = parseInput(createDropdownItemSchema, input);
  const item = await createDropdownItem(parsed);
  revalidatePath(`/setup/dropdowns/${parsed.categoryId}`);
  return item;
}
