"use client";

import { addTimelineItemAction } from "@/actions/itil-shared.actions";
import type { ItilType } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

const ITEM_TYPES = ["followup", "task", "solution", "internal_note"] as const;

function makeAction(itilType: ItilType, itilId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const timeSpentRaw = formData.get("timeSpentMinutes") as string;
      await addTimelineItemAction({
        itilType,
        itilId,
        itemType: formData.get("itemType") as (typeof ITEM_TYPES)[number],
        content: formData.get("content") as string,
        isPrivate: formData.get("isPrivate") === "on",
        timeSpentMinutes: timeSpentRaw ? Number(timeSpentRaw) : null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function TimelineForm({ itilType, itilId }: { itilType: ItilType; itilId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(itilType, itilId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <select name="itemType" aria-label="Tipo de entrada" className={inputClass}>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input name="timeSpentMinutes" type="number" min={0} placeholder="min." aria-label="Tiempo dedicado en minutos" className={`${inputClass} w-28`} />
      </div>
      <textarea name="content" required placeholder="Escribe una nota, seguimiento o solución..." aria-label="Contenido de la entrada" className={inputClass} />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="isPrivate" /> Privado (solo técnicos)
      </label>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "Agregar"}
      </button>
    </form>
  );
}
