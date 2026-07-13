"use client";

import { addUserToGroupAction } from "@/actions/groups.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

interface UserOption {
  id: string;
  displayName: string;
}

function makeAction(groupId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await addUserToGroupAction({
        groupId,
        userId: formData.get("userId") as string,
        isManager: formData.get("isManager") === "on",
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function AddMemberForm({ groupId, users }: { groupId: string; users: UserOption[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(groupId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="add-member-userId" className="text-sm font-medium">
          Usuario
        </label>
        <select id="add-member-userId" name="userId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Elegí un usuario
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isManager" className="h-4 w-4" />
        Es responsable del grupo
      </label>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "Agregar al grupo"}
      </button>
    </form>
  );
}
