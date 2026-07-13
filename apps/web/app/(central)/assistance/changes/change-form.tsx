"use client";

import { createChangeAction } from "@/actions/changes.actions";
import type { DropdownItem } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

const LEVELS = [1, 2, 3, 4, 5];

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const plannedStartAt = formData.get("plannedStartAt") as string;
      const plannedEndAt = formData.get("plannedEndAt") as string;
      await createChangeAction({
        entityId,
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        urgency: Number(formData.get("urgency")),
        impact: Number(formData.get("impact")),
        priority: Number(formData.get("priority")),
        categoryDropdownItemId: (formData.get("categoryDropdownItemId") as string) || null,
        plannedStartAt: plannedStartAt || null,
        plannedEndAt: plannedEndAt || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ChangeForm({ entityId, categoryOptions }: { entityId: string; categoryOptions: DropdownItem[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="change-title" className="text-sm font-medium">Título</label>
        <input id="change-title" name="title" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="change-content" className="text-sm font-medium">Descripción</label>
        <textarea id="change-content" name="content" required rows={4} className={inputClass} />
      </div>
      <div>
        <label htmlFor="change-category" className="text-sm font-medium">Categoría</label>
        <select id="change-category" name="categoryDropdownItemId" defaultValue="" className={inputClass}>
          <option value="">(ninguna)</option>
          {categoryOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="change-urgency" className="text-sm font-medium">Urgencia</label>
          <select id="change-urgency" name="urgency" defaultValue="3" required className={inputClass}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="change-impact" className="text-sm font-medium">Impacto</label>
          <select id="change-impact" name="impact" defaultValue="3" required className={inputClass}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="change-priority" className="text-sm font-medium">Prioridad</label>
          <select id="change-priority" name="priority" defaultValue="3" required className={inputClass}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="change-planned-start" className="text-sm font-medium">Inicio planificado</label>
          <input id="change-planned-start" name="plannedStartAt" type="datetime-local" className={inputClass} />
        </div>
        <div>
          <label htmlFor="change-planned-end" className="text-sm font-medium">Fin planificado</label>
          <input id="change-planned-end" name="plannedEndAt" type="datetime-local" className={inputClass} />
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear cambio"}
      </button>
    </form>
  );
}
