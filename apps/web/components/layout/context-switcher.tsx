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
    <div className="flex items-center gap-1.5 rounded-md border border-black/15 bg-black/[0.02] px-2 py-1 dark:border-white/15 dark:bg-white/[0.02]">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0 opacity-60">
        <rect x="4" y="3" width="12" height="14" rx="1" />
        <path d="M7 7h2M11 7h2M7 10h2M11 10h2M7 13h2M11 13h2" />
      </svg>
      <select
        aria-label="Entidad y perfil activos"
        defaultValue={currentValue}
        disabled={isPending}
        onChange={(e) => {
          const [entityId, profileId] = e.target.value.split("::") as [string, string];
          startTransition(() => {
            switchContext({ entityId, profileId });
          });
        }}
        className="border-none bg-transparent text-sm focus:ring-0"
      >
        {assignments.map((a) => (
          <option key={`${a.entityId}::${a.profileId}`} value={`${a.entityId}::${a.profileId}`}>
            {a.entityName} · {a.profileName}
          </option>
        ))}
      </select>
    </div>
  );
}
