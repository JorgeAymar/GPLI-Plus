"use client";

import { createReservationAction } from "@/actions/reservations.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(reservationItemId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createReservationAction({
        reservationItemId,
        beginAt: formData.get("beginAt") as string,
        endAt: formData.get("endAt") as string,
        comment: (formData.get("comment") as string) || null,
      });
      return {};
    } catch (err) {
      // Propagated verbatim from createReservation() - shows the real
      // "Conflicto de horario: ..." message on a schedule overlap.
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ReservationForm({ reservationItemId }: { reservationItemId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(reservationItemId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Inicio</label>
          <input name="beginAt" type="datetime-local" required className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium">Fin</label>
          <input name="endAt" type="datetime-local" required className={inputClass} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Comentario</label>
        <textarea name="comment" className={inputClass} rows={2} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Reservando..." : "Crear reserva"}
      </button>
    </form>
  );
}
