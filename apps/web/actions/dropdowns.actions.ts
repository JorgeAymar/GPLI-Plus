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

export async function createDropdownCategoryAction(input: { key: string; name: string; isSystem?: boolean }) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_DROPDOWN, RIGHT.CREATE);
  const parsed = createDropdownCategorySchema.parse(input);
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
  const parsed = createDropdownItemSchema.parse(input);
  const item = await createDropdownItem(parsed);
  revalidatePath(`/setup/dropdowns/${parsed.categoryId}`);
  return item;
}
