"use client";

import { addRuleCriteriaAction } from "@/actions/rules.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(ruleId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await addRuleCriteriaAction({
        ruleId,
        field: formData.get("field") as string,
        operator: formData.get("operator") as string,
        value: formData.get("value") as string,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function CriteriaForm({ ruleId }: { ruleId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(ruleId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="rule-criteria-field" className="text-sm font-medium">Campo</label>
        <input id="rule-criteria-field" name="field" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="rule-criteria-operator" className="text-sm font-medium">Operador</label>
        <select id="rule-criteria-operator" name="operator" defaultValue="is" className={inputClass}>
          <option value="is">Es igual a</option>
          <option value="contains">Contiene</option>
          <option value="regex_match">Coincide con regex</option>
          <option value="less_than">Menor que</option>
          <option value="greater_than">Mayor que</option>
          <option value="date_before">Fecha antes de</option>
          <option value="date_after">Fecha después de</option>
        </select>
      </div>
      <div>
        <label htmlFor="rule-criteria-value" className="text-sm font-medium">Valor</label>
        <input id="rule-criteria-value" name="value" required className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "Agregar criterio"}
      </button>
    </form>
  );
}
