"use client";

import { addValidationAction } from "@/actions/itil-shared.actions";
import type { ItilType, User } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(itilType: ItilType, itilId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await addValidationAction({
        itilType,
        itilId,
        validatorKind: "user",
        validatorId: formData.get("validatorId") as string,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ValidationForm({ itilType, itilId, users }: { itilType: ItilType; itilId: string; users: User[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(itilType, itilId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label className="text-sm font-medium">Solicitar aprobación a</label>
        <select name="validatorId" required className={inputClass}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "..." : "Solicitar"}
      </button>
    </form>
  );
}
