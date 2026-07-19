import { randomUUID } from "node:crypto";
import { db, documentItems, documents, type Document } from "@itsm/db";
import { and, desc, eq } from "drizzle-orm";
import { createStorageAdapter } from "../storage/storage-adapter";

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadDocument(input: {
  entityId: string;
  name: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  uploadedByUserId: string;
}): Promise<Document> {
  const storageKey = `${input.entityId}/${randomUUID()}-${sanitizeFilename(input.filename)}`;
  const adapter = createStorageAdapter();
  await adapter.save(storageKey, input.buffer);

  const [created] = await db
    .insert(documents)
    .values({
      entityId: input.entityId,
      name: input.name,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      storageKey,
      uploadedByUserId: input.uploadedByUserId,
    })
    .returning();
  if (!created) throw new Error("Failed to insert document");
  return created;
}

export async function attachDocumentToItem(documentId: string, itemType: string, itemId: string): Promise<void> {
  await db.insert(documentItems).values({ documentId, itemType, itemId });
}

/** The reverse of listDocumentsForItem - what item(s) is this document attached to. A document can be attached to more than one item. */
export async function listItemAttachmentsForDocument(documentId: string): Promise<{ itemType: string; itemId: string }[]> {
  return db
    .select({ itemType: documentItems.itemType, itemId: documentItems.itemId })
    .from(documentItems)
    .where(eq(documentItems.documentId, documentId));
}

export async function listDocumentsForItem(itemType: string, itemId: string): Promise<Document[]> {
  const rows = await db
    .select({ document: documents })
    .from(documentItems)
    .innerJoin(documents, eq(documents.id, documentItems.documentId))
    .where(and(eq(documentItems.itemType, itemType), eq(documentItems.itemId, itemId)))
    .orderBy(desc(documents.createdAt));
  return rows.map((r) => r.document);
}

export async function removeDocumentAttachment(documentId: string, itemType: string, itemId: string): Promise<void> {
  await db
    .delete(documentItems)
    .where(and(eq(documentItems.documentId, documentId), eq(documentItems.itemType, itemType), eq(documentItems.itemId, itemId)));
}

export async function getDocument(id: string): Promise<Document | undefined> {
  const [document] = await db.select().from(documents).where(eq(documents.id, id));
  return document;
}

export async function readDocumentContent(
  id: string,
): Promise<{ buffer: Buffer; mimeType: string; filename: string; entityId: string } | undefined> {
  const document = await getDocument(id);
  if (!document) return undefined;
  const adapter = createStorageAdapter();
  const buffer = await adapter.read(document.storageKey);
  return { buffer, mimeType: document.mimeType, filename: document.filename, entityId: document.entityId };
}

/** Hard-deletes the document (file + row) - cascades document_items via FK. */
export async function deleteDocument(id: string): Promise<void> {
  const document = await getDocument(id);
  if (!document) return;
  const adapter = createStorageAdapter();
  await adapter.delete(document.storageKey);
  await db.delete(documents).where(eq(documents.id, id));
}
