"use client";

import { createReservationItemAction } from "@/actions/reservations.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

interface AssetOption {
  id: string;
  name: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const result = await createReservationItemAction({
    assetId: formData.get("assetId") as string,
    comment: (formData.get("comment") as string) || null,
  });
  return result.error ? { error: result.error } : {};
}

export function ReservationItemForm({ assets }: { assets: AssetOption[] }) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="reservation-item-asset" className="text-sm font-medium">Activo</label>
        <select id="reservation-item-asset" name="assetId" required className={inputClass}>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="reservation-item-comment" className="text-sm font-medium">Comentario</label>
        <textarea id="reservation-item-comment" name="comment" className={inputClass} rows={2} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending || assets.length === 0}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Habilitar para reserva"}
      </button>
    </form>
  );
}
