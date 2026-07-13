import type { ItilTimelineItem, ItilType } from "@itsm/db";
import { TimelineForm } from "./timeline-form";

export function TimelineSection({ itilType, itilId, items }: { itilType: ItilType; itilId: string; items: ItilTimelineItem[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium opacity-70">Historial</h2>
      <ul className="mb-3 space-y-2">
        {items.map((item) => (
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
      <TimelineForm itilType={itilType} itilId={itilId} />
    </div>
  );
}
