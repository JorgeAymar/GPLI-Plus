"use client";

import { switchContext } from "@/actions/session.actions";
import { useTransition } from "react";

interface Assignment {
  entityId: string;
  entityName: string;
  profileId: string;
  profileName: string;
}

export function ContextSwitcher({
  assignments,
  activeEntityId,
  activeProfileId,
}: {
  assignments: Assignment[];
  activeEntityId: string;
  activeProfileId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const currentValue = `${activeEntityId}::${activeProfileId}`;

  return (
    <select
      defaultValue={currentValue}
      disabled={isPending}
      onChange={(e) => {
        const [entityId, profileId] = e.target.value.split("::") as [string, string];
        startTransition(() => {
          switchContext({ entityId, profileId });
        });
      }}
      className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/15"
    >
      {assignments.map((a) => (
        <option key={`${a.entityId}::${a.profileId}`} value={`${a.entityId}::${a.profileId}`}>
          {a.entityName} · {a.profileName}
        </option>
      ))}
    </select>
  );
}
