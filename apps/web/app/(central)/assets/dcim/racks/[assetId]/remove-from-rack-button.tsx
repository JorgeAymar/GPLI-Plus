"use client";

import { actionErrorMessage } from "@/lib/action-error";
import { removeFromRackAction } from "@/actions/dcim.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(id: string, rackAssetId: string) {
  return async (): Promise<FormState> => {
    try {
      await removeFromRackAction(id, rackAssetId);
      return {};
    } catch (err) {
      return { error: actionErrorMessage(err) };
    }
  };
}

export function RemoveFromRackButton({ id, rackAssetId }: { id: string; rackAssetId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(id, rackAssetId), undefined);

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {isPending ? "..." : "Quitar"}
      </button>
      {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
