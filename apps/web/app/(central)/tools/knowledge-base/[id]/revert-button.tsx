"use client";

import { useTransition } from "react";

export function RevertButton({
  articleId,
  auditLogId,
  revertAction,
}: {
  articleId: string;
  auditLogId: string;
  revertAction: (articleId: string, auditLogId: string) => Promise<unknown>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await revertAction(articleId, auditLogId);
      })}
      className="rounded-md border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/15"
    >
      {isPending ? "Revirtiendo..." : "Revertir a esta versión"}
    </button>
  );
}
