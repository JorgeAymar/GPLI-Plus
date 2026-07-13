"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createServiceCatalogItem, createServiceCatalogItemSchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createServiceCatalogItemAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_SERVICE_CATALOG, RIGHT.CREATE);
  const parsed = createServiceCatalogItemSchema.parse(input);
  const item = await createServiceCatalogItem(parsed);
  revalidatePath("/setup/service-catalog");
  return item;
}
