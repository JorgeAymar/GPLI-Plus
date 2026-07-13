import { listDocumentsForItem } from "@itsm/core";
import { RemoveDocumentButton } from "./remove-document-button";
import { UploadDocumentForm } from "./upload-document-form";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reusable attachments UI - one shared component + one storage/schema
 * mechanism (documents/document_items) reused by any itemType instead of a
 * bespoke attachments feature per module. See document-service.ts.
 */
export async function AttachmentsSection({
  itemType,
  itemId,
  revalidatePathTarget,
}: {
  itemType: string;
  itemId: string;
  revalidatePathTarget: string;
}) {
  const docs = await listDocumentsForItem(itemType, itemId);

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium opacity-70">Adjuntos</h2>
      <ul className="mb-3 space-y-1">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-sm">
            <a href={`/api/documents/${d.id}`} className="hover:underline" target="_blank" rel="noreferrer">
              {d.name}
            </a>
            <span className="opacity-40">({formatSize(d.sizeBytes)})</span>
            <RemoveDocumentButton documentId={d.id} itemType={itemType} itemId={itemId} revalidatePathTarget={revalidatePathTarget} />
          </li>
        ))}
        {docs.length === 0 ? <li className="text-sm opacity-50">Sin adjuntos todavía.</li> : null}
      </ul>
      <UploadDocumentForm itemType={itemType} itemId={itemId} revalidatePathTarget={revalidatePathTarget} />
    </div>
  );
}
