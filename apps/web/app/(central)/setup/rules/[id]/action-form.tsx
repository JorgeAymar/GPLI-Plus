"use client";

import { addRuleActionAction } from "@/actions/rules.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(ruleId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await addRuleActionAction({
        ruleId,
        actionType: formData.get("actionType") as string,
        field: formData.get("field") as string,
        value: formData.get("value") as string,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ActionForm({ ruleId }: { ruleId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(ruleId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Tipo de acción</label>
        <select name="actionType" defaultValue="assign" className={inputClass}>
          <option value="assign">Asignar</option>
          <option value="append">Agregar al final</option>
          <option value="regex_result">Resultado de regex</option>
          <option value="stop_processing">Detener procesamiento</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Campo</label>
        <input name="field" required className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Valor</label>
        <input name="value" required className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "Agregar acción"}
      </button>
    </form>
  );
}
