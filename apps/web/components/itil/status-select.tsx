"use client";

import { useTransition } from "react";

const STATUSES = ["new", "assigned", "planned", "pending", "solved", "closed"] as const;

export function StatusSelect({
  id,
  currentStatus,
  updateStatusAction,
}: {
  id: string;
  currentStatus: string;
  updateStatusAction: (id: string, status: string) => Promise<unknown>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentStatus}
      disabled={isPending}
      onChange={(e) => {
        const status = e.target.value;
        startTransition(async () => {
          await updateStatusAction(id, status);
        });
      }}
      className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/15"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
