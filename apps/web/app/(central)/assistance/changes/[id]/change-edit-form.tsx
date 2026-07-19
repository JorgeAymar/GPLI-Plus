"use client";

import { updateChangeAction } from "@/actions/changes.actions";
import { useFormSuccessToast } from "@/components/toast";
import type { Change } from "@itsm/db";
import { useActionState, useRef } from "react";

interface FormState {
  error?: string;
}

const LEVELS = [1, 2, 3, 4, 5];

function toLocalInputValue(d: Date | null): string {
  return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
}

function makeAction(changeId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const plannedStartAt = formData.get("plannedStartAt") as string;
      const plannedEndAt = formData.get("plannedEndAt") as string;
      await updateChangeAction(changeId, {
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        urgency: Number(formData.get("urgency")),
        impact: Number(formData.get("impact")),
        priority: Number(formData.get("priority")),
        plannedStartAt: plannedStartAt ? plannedStartAt : null,
        plannedEndAt: plannedEndAt ? plannedEndAt : null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ChangeEditForm({ change }: { change: Change }) {
  const [state, formAction, isPending] = useActionState(makeAction(change.id), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useFormSuccessToast(state, formRef, "Cambio actualizado.");
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    // Keyed on the editable fields so a successful edit remounts just this
    // <form> to pick up fresh `defaultValue`s after `revalidatePath` - kept
    // on the <form> itself rather than on <ChangeEditForm> in page.tsx so the
    // remount doesn't tear down this component's `useActionState`/toast state
    // in the same commit the refreshed data lands in (see asset-edit-form.tsx
    // for the full rationale).
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      key={`${change.title}-${change.urgency}-${change.impact}-${change.priority}-${change.plannedStartAt}-${change.plannedEndAt}`}
    >
      <div>
        <label htmlFor="change-edit-title" className="text-sm font-medium">Título</label>
        <input id="change-edit-title" name="title" required defaultValue={change.title} className={inputClass} />
      </div>
      <div>
        <label htmlFor="change-edit-content" className="text-sm font-medium">Descripción</label>
        <textarea
          id="change-edit-content"
          name="content"
          required
          rows={4}
          defaultValue={change.content}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="change-edit-urgency" className="text-sm font-medium">Urgencia</label>
          <select
            id="change-edit-urgency"
            name="urgency"
            defaultValue={change.urgency}
            required
            className={inputClass}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="change-edit-impact" className="text-sm font-medium">Impacto</label>
          <select id="change-edit-impact" name="impact" defaultValue={change.impact} required className={inputClass}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="change-edit-priority" className="text-sm font-medium">Prioridad</label>
          <select
            id="change-edit-priority"
            name="priority"
            defaultValue={change.priority}
            required
            className={inputClass}
          >
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
          <label htmlFor="change-edit-planned-start" className="text-sm font-medium">Inicio planificado</label>
          <input
            id="change-edit-planned-start"
            name="plannedStartAt"
            type="datetime-local"
            defaultValue={toLocalInputValue(change.plannedStartAt)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="change-edit-planned-end" className="text-sm font-medium">Fin planificado</label>
          <input
            id="change-edit-planned-end"
            name="plannedEndAt"
            type="datetime-local"
            defaultValue={toLocalInputValue(change.plannedEndAt)}
            className={inputClass}
          />
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
