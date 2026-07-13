"use client";

import { assignSlaAction } from "@/actions/itil-shared.actions";
import type { ItilType, SlaPolicy } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(itilType: ItilType, itilId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await assignSlaAction({
        itilType,
        itilId,
        slaPolicyId: formData.get("slaPolicyId") as string,
        slaType: formData.get("slaType") as "tto" | "ttr",
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function SlaForm({ itilType, itilId, policies }: { itilType: ItilType; itilId: string; policies: SlaPolicy[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(itilType, itilId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div>
        <label className="text-sm font-medium">Política</label>
        <select name="slaPolicyId" required className={inputClass}>
          {policies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Tipo</label>
        <select name="slaType" className={inputClass}>
          <option value="tto">Primera respuesta</option>
          <option value="ttr">Resolución</option>
        </select>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending || policies.length === 0}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "..." : "Asignar SLA"}
      </button>
    </form>
  );
}
