import { updateChangeStatusAction } from "@/actions/changes.actions";
import { ActorsSection } from "@/components/itil/actors-section";
import { CostsSection } from "@/components/itil/costs-section";
import { StatusSelect } from "@/components/itil/status-select";
import { TimelineSection } from "@/components/itil/timeline-section";
import { ValidationsSection } from "@/components/itil/validations-section";
import { getChange, listActors, listCosts, listTimelineItems, listUsers, listValidations } from "@itsm/core";
import { notFound } from "next/navigation";

export default async function ChangeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const change = await getChange(id);
  if (!change) notFound();

  const [actors, timelineItems, validations, costs, users] = await Promise.all([
    listActors("change", id),
    listTimelineItems("change", id),
    listValidations("change", id),
    listCosts("change", id),
    listUsers(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{change.title}</h1>
        <StatusSelect id={change.id} currentStatus={change.status} updateStatusAction={updateChangeStatusAction} />
      </div>
      <p className="whitespace-pre-wrap text-sm opacity-80">{change.content}</p>
      <p className="text-sm opacity-60">
        Urgencia: {change.urgency} · Impacto: {change.impact} · Prioridad: {change.priority}
      </p>
      {change.plannedStartAt || change.plannedEndAt ? (
        <p className="text-sm opacity-60">
          Planificado: {change.plannedStartAt?.toLocaleString() ?? "?"} → {change.plannedEndAt?.toLocaleString() ?? "?"}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-8">
        <ActorsSection itilType="change" itilId={id} actors={actors} users={users} />
        <ValidationsSection itilType="change" itilId={id} validations={validations} users={users} />
      </div>

      <TimelineSection itilType="change" itilId={id} items={timelineItems} />

      <CostsSection itilType="change" itilId={id} costs={costs} />
    </div>
  );
}
