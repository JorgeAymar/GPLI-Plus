"use client";

import { createRuleAction } from "@/actions/rules.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createRuleAction({
        entityId,
        ruleType: formData.get("ruleType") as string,
        name: formData.get("name") as string,
        ranking: Number(formData.get("ranking") || 0),
        matchType: formData.get("matchType") as string,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function RuleForm({ entityId }: { entityId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Tipo de regla (ruleType)</label>
        <input name="ruleType" required placeholder="ticket, asset_import, right_assignment..." className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Nombre</label>
        <input name="name" required className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Orden (ranking)</label>
          <input name="ranking" type="number" defaultValue={0} className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium">Coincidencia</label>
          <select name="matchType" defaultValue="all" className={inputClass}>
            <option value="all">Todas (AND)</option>
            <option value="any">Cualquiera (OR)</option>
          </select>
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear regla"}
      </button>
    </form>
  );
}
