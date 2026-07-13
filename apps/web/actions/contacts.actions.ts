"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createContact, createContactSchema, requireRight, softDeleteContact } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createContactAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONTACT, RIGHT.CREATE);
  const parsed = createContactSchema.parse(input);
  const contact = await createContact(parsed);
  revalidatePath("/management/contacts");
  return contact;
}

export async function softDeleteContactAction(id: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONTACT, RIGHT.DELETE);
  const contact = await softDeleteContact(id);
  revalidatePath("/management/contacts");
  return contact;
}
