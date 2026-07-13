"use client";

import { createSoftwareVersionAction } from "@/actions/software.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(softwareId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createSoftwareVersionAction({ softwareId, name: formData.get("name") as string });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function SoftwareVersionForm({ softwareId }: { softwareId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(softwareId), undefined);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label className="text-sm font-medium">Versión</label>
        <input
          name="name"
          required
          placeholder="23H2"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "..." : "Agregar"}
      </button>
    </form>
  );
}
