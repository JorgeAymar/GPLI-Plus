import type { ItilSlaAssignment, ItilType, SlaPolicy } from "@itsm/db";
import { SlaForm } from "./sla-form";

export function SlaSection({
  itilType,
  itilId,
  assignments,
  policies,
}: {
  itilType: ItilType;
  itilId: string;
  assignments: ItilSlaAssignment[];
  policies: SlaPolicy[];
}) {
  return (
    <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
      <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">SLA</h2>
      <ul className="mb-3 space-y-1">
        {assignments.map((a) => (
          <li key={a.id} className="text-sm">
            {a.slaType === "tto" ? "Primera respuesta" : "Resolución"} — vence {a.dueAt.toLocaleString()}{" "}
            <span className={a.isBreached ? "text-red-600" : "text-green-600"}>{a.isBreached ? "incumplido" : "en curso"}</span>
          </li>
        ))}
        {assignments.length === 0 ? <li className="text-sm opacity-50">Sin SLA asignado.</li> : null}
      </ul>
      <SlaForm itilType={itilType} itilId={itilId} policies={policies} />
    </div>
  );
}
