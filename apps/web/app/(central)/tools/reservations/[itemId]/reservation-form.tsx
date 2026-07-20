"use client";

import { createReservationAction } from "@/actions/reservations.actions";
import { useActionState, useState } from "react";

interface FormState {
  error?: string;
}

function makeAction(reservationItemId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    // endAt > beginAt is checked client-side in handleSubmit, BEFORE this action
    // ever runs (see ReservationForm) - React resets a form's uncontrolled fields
    // whenever an action tied to it completes, success or not, so letting an
    // inverted range reach this call would wipe out beginAt/endAt/comment the
    // user just typed. Not re-checked here: createReservationSchema's own
    // endAt > beginAt .refine(), invoked inside createReservationAction ->
    // createReservation(), is the real server-side defense-in-depth backstop -
    // duplicating that rule in this thin wrapper would just recheck it twice in
    // the same call stack for no benefit.
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
  const [rangeError, setRangeError] = useState<string | null>(null);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  // Checked here, before the action runs - React resets a form's uncontrolled
  // fields whenever its action completes (success or error), so letting an
  // inverted endAt/beginAt range reach createReservationAction would wipe out
  // beginAt, endAt, and comment instead of just flagging the one thing that's
  // wrong. Message text mirrors createReservationSchema's own .refine() exactly.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const beginAt = (form.elements.namedItem("beginAt") as HTMLInputElement).value;
    const endAt = (form.elements.namedItem("endAt") as HTMLInputElement).value;
    if (new Date(endAt) <= new Date(beginAt)) {
      e.preventDefault();
      setRangeError("endAt debe ser posterior a beginAt");
      return;
    }
    setRangeError(null);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="reservation-begin-at" className="text-sm font-medium">Inicio</label>
          <input id="reservation-begin-at" name="beginAt" type="datetime-local" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="reservation-end-at" className="text-sm font-medium">Fin</label>
          <input id="reservation-end-at" name="endAt" type="datetime-local" required className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="reservation-comment" className="text-sm font-medium">Comentario</label>
        <textarea id="reservation-comment" name="comment" className={inputClass} rows={2} />
      </div>
      {rangeError ?? state?.error ? <p className="text-sm text-red-600">{rangeError ?? state?.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Reservando..." : "Crear reserva"}
      </button>
    </form>
  );
}
