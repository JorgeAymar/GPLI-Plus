"use server";

import { moduleForItemType } from "@/lib/document-access";
import { requireAuthContext } from "@/lib/session";
import {
  attachDocumentSchema,
  attachDocumentToItem,
  removeDocumentAttachment,
  requireRight,
  RIGHT,
  uploadDocument,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function uploadDocumentAction(formData: FormData, revalidatePathTarget: string) {
  const context = await requireAuthContext();
  const { itemType, itemId } = attachDocumentSchema.parse({
    itemType: formData.get("itemType"),
    itemId: formData.get("itemId"),
  });
  await requireRight(context, moduleForItemType(itemType), RIGHT.UPDATE);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Seleccioná un archivo para subir");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const document = await uploadDocument({
    entityId: context.activeEntity.id,
    name: file.name,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    buffer,
    uploadedByUserId: context.user.id,
  });
  await attachDocumentToItem(document.id, itemType, itemId);
  revalidatePath(revalidatePathTarget);
  return document;
}

export async function removeDocumentAction(documentId: string, itemType: string, itemId: string, revalidatePathTarget: string) {
  const context = await requireAuthContext();
  await requireRight(context, moduleForItemType(itemType), RIGHT.DELETE);
  await removeDocumentAttachment(documentId, itemType, itemId);
  revalidatePath(revalidatePathTarget);
}
