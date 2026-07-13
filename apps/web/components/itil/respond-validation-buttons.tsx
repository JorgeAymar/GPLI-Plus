"use client";

import { respondToValidationAction } from "@/actions/itil-shared.actions";
import type { ItilType } from "@itsm/db";
import { useState, useTransition } from "react";

export function RespondValidationButtons({ id, itilType, itilId }: { id: string; itilType: ItilType; itilId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function respond(status: "approved" | "refused") {
    startTransition(async () => {
      try {
        await respondToValidationAction(id, itilType, itilId, { status });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    });
  }

  return (
    <span className="ml-2 inline-flex items-center gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => respond("approved")}
        className="rounded border border-black/15 px-2 py-0.5 text-xs disabled:opacity-50 dark:border-white/15"
      >
        Aprobar
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => respond("refused")}
        className="rounded border border-black/15 px-2 py-0.5 text-xs disabled:opacity-50 dark:border-white/15"
      >
        Rechazar
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
