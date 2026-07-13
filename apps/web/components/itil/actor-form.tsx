"use client";

import { addActorAction } from "@/actions/itil-shared.actions";
import type { ItilType, User } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

const ACTOR_ROLES = ["requester", "assignee", "observer"] as const;

function makeAction(itilType: ItilType, itilId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await addActorAction({
        itilType,
        itilId,
        actorRole: formData.get("actorRole") as (typeof ACTOR_ROLES)[number],
        actorKind: "user",
        actorId: formData.get("userId") as string,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ActorForm({ itilType, itilId, users }: { itilType: ItilType; itilId: string; users: User[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(itilType, itilId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <select name="actorRole" className={inputClass}>
          {ACTOR_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select name="userId" required className={inputClass}>
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
        className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "Agregar actor"}
      </button>
    </form>
  );
}
