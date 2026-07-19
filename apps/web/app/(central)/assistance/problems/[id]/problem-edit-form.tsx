"use client";

import { updateProblemAction } from "@/actions/problems.actions";
import { useFormSuccessToast } from "@/components/toast";
import type { Problem } from "@itsm/db";
import { useActionState, useRef } from "react";

interface FormState {
  error?: string;
}

const LEVELS = [1, 2, 3, 4, 5];

function makeAction(problemId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await updateProblemAction(problemId, {
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        urgency: Number(formData.get("urgency")),
        impact: Number(formData.get("impact")),
        priority: Number(formData.get("priority")),
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ProblemEditForm({ problem }: { problem: Problem }) {
  const [state, formAction, isPending] = useActionState(makeAction(problem.id), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useFormSuccessToast(state, formRef, "Problema actualizado.");
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    // Keyed on the editable fields so a successful edit remounts just this
    // <form> to pick up fresh `defaultValue`s after `revalidatePath` - kept
    // on the <form> itself rather than on <ProblemEditForm> in page.tsx so the
    // remount doesn't tear down this component's `useActionState`/toast state
    // in the same commit the refreshed data lands in (see asset-edit-form.tsx
    // for the full rationale).
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      key={`${problem.title}-${problem.content}-${problem.urgency}-${problem.impact}-${problem.priority}`}
    >
      <div>
        <label htmlFor="problem-edit-title" className="text-sm font-medium">Título</label>
        <input id="problem-edit-title" name="title" required defaultValue={problem.title} className={inputClass} />
      </div>
      <div>
        <label htmlFor="problem-edit-content" className="text-sm font-medium">Descripción</label>
        <textarea
          id="problem-edit-content"
          name="content"
          required
          rows={4}
          defaultValue={problem.content}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="problem-edit-urgency" className="text-sm font-medium">Urgencia</label>
          <select
            id="problem-edit-urgency"
            name="urgency"
            defaultValue={problem.urgency}
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
          <label htmlFor="problem-edit-impact" className="text-sm font-medium">Impacto</label>
          <select id="problem-edit-impact" name="impact" defaultValue={problem.impact} required className={inputClass}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="problem-edit-priority" className="text-sm font-medium">Prioridad</label>
          <select
            id="problem-edit-priority"
            name="priority"
            defaultValue={problem.priority}
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
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
