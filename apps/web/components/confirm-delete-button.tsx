"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Danger-styled delete button with a native `confirm()` guard. Calls the
 * given server action with `id`, then refreshes the current route so the
 * list reflects the deletion immediately - this is deliberately
 * `router.refresh()` rather than relying solely on the server action's own
 * `revalidatePath` calls, since some actions (e.g. asset soft-delete) only
 * revalidate a parent path and not the exact dynamic route being viewed.
 */
export function ConfirmDeleteButton({
  id,
  action,
  confirmMessage = "¿Eliminar este registro? Esta acción no se puede deshacer.",
  label = "Eliminar",
  pendingLabel = "Eliminando...",
}: {
  id: string;
  action: (id: string) => Promise<unknown>;
  confirmMessage?: string;
  label?: string;
  pendingLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      try {
        await action(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        {isPending ? pendingLabel : label}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
