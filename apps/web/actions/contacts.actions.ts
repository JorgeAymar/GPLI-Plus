"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createContact, createContactSchema, getContact, recordAuditLog, requireRight, softDeleteContact } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createContactAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONTACT, RIGHT.CREATE);
  const parsed = createContactSchema.parse(input);
  const contact = await createContact(parsed);
  await recordAuditLog({
    entityId: contact.entityId,
    actorUserId: context.user.id,
    action: "create",
    objectType: "contact",
    objectId: contact.id,
    after: contact,
  });
  revalidatePath("/management/contacts");
  return contact;
}

export async function softDeleteContactAction(id: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONTACT, RIGHT.DELETE);
  const before = await getContact(id);
  const contact = await softDeleteContact(id);
  await recordAuditLog({
    entityId: contact.entityId,
    actorUserId: context.user.id,
    action: "delete",
    objectType: "contact",
    objectId: contact.id,
    before,
  });
  revalidatePath("/management/contacts");
  return contact;
}
