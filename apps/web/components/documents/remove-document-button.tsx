"use client";

import { removeDocumentAction } from "@/actions/documents.actions";
import { useState, useTransition } from "react";

export function RemoveDocumentButton({
  documentId,
  itemType,
  itemId,
  revalidatePathTarget,
}: {
  documentId: string;
  itemType: string;
  itemId: string;
  revalidatePathTarget: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              await removeDocumentAction(documentId, itemType, itemId, revalidatePathTarget);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error desconocido");
            }
          })
        }
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "..." : "Quitar"}
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
