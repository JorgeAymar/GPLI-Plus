"use client";

import { cancelReservationAction } from "@/actions/reservations.actions";
import { useTransition } from "react";

export function CancelReservationButton({
  reservationId,
  reservationItemId,
}: {
  reservationId: string;
  reservationItemId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await cancelReservationAction(reservationId, reservationItemId);
        })
      }
      className="rounded-md border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/15"
    >
      {isPending ? "Cancelando..." : "Cancelar"}
    </button>
  );
}
