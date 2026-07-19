import { moduleForItemType } from "@/lib/document-access";
import { getAuthContext } from "@/lib/session";
import { getEffectiveRights, hasRight, listItemAttachmentsForDocument, readDocumentContent, RIGHT } from "@itsm/core";

/**
 * A document can be attached to more than one item (documentItems is a join table), so
 * authorization here means: does the caller have READ on the module that owns AT LEAST ONE
 * of the items this document is attached to, checked against the document's own entity (not
 * the caller's currently-active entity - see requireTicketRight in tickets.actions.ts for why
 * that distinction matters). A document with zero attachments, or where the caller can't read
 * any of them, is denied - bare "is logged in" is not enough on its own.
 */
async function canReadDocument(userId: string, documentEntityId: string, documentId: string): Promise<boolean> {
  const attachments = await listItemAttachmentsForDocument(documentId);
  for (const attachment of attachments) {
    let moduleKey: string;
    try {
      moduleKey = moduleForItemType(attachment.itemType);
    } catch {
      continue; // Unknown itemType - skip rather than throw, another attachment may still grant access.
    }
    const rights = await getEffectiveRights(userId, documentEntityId, moduleKey);
    if (hasRight(rights, RIGHT.READ)) return true;
  }
  return false;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const content = await readDocumentContent(id);
  if (!content) return new Response("Not found", { status: 404 });

  const allowed = await canReadDocument(context.user.id, content.entityId, id);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  return new Response(new Uint8Array(content.buffer), {
    headers: {
      "Content-Type": content.mimeType,
      "Content-Disposition": `attachment; filename="${content.filename.replace(/"/g, "")}"`,
      "Content-Length": String(content.buffer.length),
    },
  });
}
