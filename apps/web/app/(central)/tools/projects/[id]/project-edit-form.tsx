"use client";

import { updateProjectAction } from "@/actions/projects.actions";
import { useFormSuccessToast } from "@/components/toast";
import type { Project } from "@itsm/db";
import { useActionState, useRef } from "react";

interface FormState {
  error?: string;
}

const LEVELS = [1, 2, 3, 4, 5];

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function makeAction(projectId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const code = (formData.get("code") as string) || "";
      const planStartAt = (formData.get("planStartAt") as string) || "";
      const planEndAt = (formData.get("planEndAt") as string) || "";
      await updateProjectAction(projectId, {
        name: formData.get("name") as string,
        code: code || null,
        priority: Number(formData.get("priority")),
        planStartAt: planStartAt || null,
        planEndAt: planEndAt || null,
        percentDone: Number(formData.get("percentDone")),
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ProjectEditForm({ project }: { project: Project }) {
  const [state, formAction, isPending] = useActionState(makeAction(project.id), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useFormSuccessToast(state, formRef, "Proyecto actualizado.");
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    // Keyed on the editable fields so a successful edit remounts just this
    // <form> to pick up fresh `defaultValue`s after `revalidatePath` - kept
    // on the <form> itself rather than on <ProjectEditForm> in page.tsx so the
    // remount doesn't tear down this component's `useActionState`/toast state
    // in the same commit the refreshed data lands in (see asset-edit-form.tsx
    // for the full rationale).
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      key={`${project.name}-${project.code}-${project.priority}-${project.planStartAt}-${project.planEndAt}-${project.percentDone}`}
    >
      <div>
        <label htmlFor="project-name" className="text-sm font-medium">Nombre</label>
        <input id="project-name" name="name" required defaultValue={project.name} className={inputClass} />
      </div>
      <div>
        <label htmlFor="project-code" className="text-sm font-medium">Código</label>
        <input id="project-code" name="code" defaultValue={project.code ?? ""} className={inputClass} />
      </div>
      <div>
        <label htmlFor="project-priority" className="text-sm font-medium">Prioridad</label>
        <select id="project-priority" name="priority" defaultValue={project.priority} required className={inputClass}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="project-plan-start" className="text-sm font-medium">Inicio planeado</label>
          <input
            id="project-plan-start"
            name="planStartAt"
            type="date"
            defaultValue={toDateInputValue(project.planStartAt)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="project-plan-end" className="text-sm font-medium">Fin planeado</label>
          <input
            id="project-plan-end"
            name="planEndAt"
            type="date"
            defaultValue={toDateInputValue(project.planEndAt)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="project-percent-done" className="text-sm font-medium">Avance (%)</label>
        <input
          id="project-percent-done"
          name="percentDone"
          type="number"
          min={0}
          max={100}
          required
          defaultValue={project.percentDone}
          className={inputClass}
        />
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
