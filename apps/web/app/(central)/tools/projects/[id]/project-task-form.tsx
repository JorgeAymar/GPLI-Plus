"use client";

import { createProjectTaskAction } from "@/actions/projects.actions";
import type { ProjectTask } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(projectId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const parentTaskId = formData.get("parentTaskId") as string;
      await createProjectTaskAction({
        projectId,
        name: formData.get("name") as string,
        parentTaskId: parentTaskId || null,
        isMilestone: formData.get("isMilestone") === "on",
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ProjectTaskForm({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(projectId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="project-task-name" className="text-sm font-medium">Nombre</label>
        <input id="project-task-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="project-task-parent" className="text-sm font-medium">Tarea padre (opcional)</label>
        <select id="project-task-parent" name="parentTaskId" defaultValue="" className={inputClass}>
          <option value="">Ninguna (nivel superior)</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isMilestone" /> Es un hito
      </label>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear tarea"}
      </button>
    </form>
  );
}
