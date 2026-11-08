"use client";

import { actionErrorMessage } from "@/lib/action-error";
import { removeUserFromGroupAction } from "@/actions/groups.actions";
import { useState, useTransition } from "react";

export function RemoveMemberButton({ userId, groupId }: { userId: string; groupId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              await removeUserFromGroupAction(userId, groupId);
            } catch (err) {
              setError(actionErrorMessage(err));
            }
          })
        }
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "..." : "Quitar"}
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
