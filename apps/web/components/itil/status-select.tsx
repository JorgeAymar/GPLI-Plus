"use client";

import { useState, useTransition } from "react";
import { STATUS_LABELS, StatusBadge } from "@/components/status-badge";

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
  const [status, setStatus] = useState(currentStatus);

  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={status} />
      <select
        aria-label="Estado"
        defaultValue={currentStatus}
        disabled={isPending}
        onChange={(e) => {
          const nextStatus = e.target.value;
          setStatus(nextStatus);
          startTransition(async () => {
            await updateStatusAction(id, nextStatus);
          });
        }}
        className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/15"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s] ?? s}
          </option>
        ))}
      </select>
    </div>
  );
}
