"use client";

import { revokeMyApiClientAction } from "@/actions/account.actions";
import { useActionState } from "react";

interface RevokeState {
  error?: string;
}

async function action(_prev: RevokeState | undefined, formData: FormData): Promise<RevokeState> {
  try {
    await revokeMyApiClientAction(formData.get("id") as string);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function RevokeTokenButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {isPending ? "Revocando..." : "Revocar"}
      </button>
      {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
