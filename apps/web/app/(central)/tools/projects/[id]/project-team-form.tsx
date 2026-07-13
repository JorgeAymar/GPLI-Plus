"use client";

import { addProjectTeamMemberAction } from "@/actions/projects.actions";
import type { User } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

// v1 simplification: memberKind is fixed to "user" here. The schema supports
// group/supplier/contact too, but this app has no unified picker across those
// four entity types yet - building one is out of scope for this slice.
function makeAction(projectId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await addProjectTeamMemberAction({
        projectId,
        memberKind: "user",
        memberId: formData.get("userId") as string,
        role: formData.get("role") as string,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ProjectTeamForm({ projectId, users }: { projectId: string; users: User[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(projectId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="project-team-user" className="text-sm font-medium">Usuario</label>
        <select id="project-team-user" name="userId" required className={inputClass}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="project-team-role" className="text-sm font-medium">Rol</label>
        <select id="project-team-role" name="role" defaultValue="member" className={inputClass}>
          <option value="member">Miembro</option>
          <option value="owner">Responsable</option>
        </select>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending || users.length === 0}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "Agregar al equipo"}
      </button>
    </form>
  );
}
