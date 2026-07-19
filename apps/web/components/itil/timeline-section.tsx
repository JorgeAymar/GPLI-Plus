"use client";

import type { ItilTimelineItem, ItilType } from "@itsm/db";
import { useState } from "react";
import { TimelineForm } from "./timeline-form";

const COLLAPSED_COUNT = 3;

export function TimelineSection({ itilType, itilId, items }: { itilType: ItilType; itilId: string; items: ItilTimelineItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const totalMinutes = items.reduce((sum, item) => sum + (item.timeSpentMinutes ?? 0), 0);
  const visibleItems = expanded ? items : items.slice(-COLLAPSED_COUNT);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium opacity-70">Historial</h2>
        {totalMinutes > 0 ? <span className="text-sm font-medium">Tiempo total: {totalMinutes} min</span> : null}
      </div>

      {hiddenCount > 0 ? (
        <button type="button" onClick={() => setExpanded(true)} className="mb-2 text-sm opacity-70 hover:opacity-100">
          Ver historial completo ({items.length})
        </button>
      ) : null}

      <ul className="mb-3 space-y-2">
        {visibleItems.map((item) => (
          <li key={item.id} className="rounded-md border border-black/10 p-2 text-sm dark:border-white/10">
            <div className="mb-1 flex items-center gap-2 text-xs opacity-50">
              <span>{item.itemType}</span>
              {item.isPrivate ? <span>· privado</span> : null}
              {item.timeSpentMinutes ? <span>· {item.timeSpentMinutes} min</span> : null}
            </div>
            <p className="whitespace-pre-wrap">{item.content}</p>
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm opacity-50">Sin historial todavía.</li> : null}
      </ul>

      {expanded && items.length > COLLAPSED_COUNT ? (
        <button type="button" onClick={() => setExpanded(false)} className="mb-3 text-sm opacity-70 hover:opacity-100">
          Mostrar menos
        </button>
      ) : null}

      <TimelineForm itilType={itilType} itilId={itilId} />
    </div>
  );
}
