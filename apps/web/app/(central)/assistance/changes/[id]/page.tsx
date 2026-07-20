import { updateChangeStatusAction } from "@/actions/changes.actions";
import { ActorsSection } from "@/components/itil/actors-section";
import { CostsSection } from "@/components/itil/costs-section";
import { StatusSelect } from "@/components/itil/status-select";
import { TimelineSection } from "@/components/itil/timeline-section";
import { ValidationsSection } from "@/components/itil/validations-section";
import { getChange, listActors, listCosts, listTimelineItems, listUsers, listValidations } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChangeEditForm } from "./change-edit-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const change = await getChange(id);
  return { title: change?.title ?? "Cambio" };
}

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

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Editar cambio</h2>
        <ChangeEditForm change={change} />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <ActorsSection itilType="change" itilId={id} actors={actors} users={users} />
        <ValidationsSection itilType="change" itilId={id} validations={validations} users={users} />
      </div>

      <TimelineSection itilType="change" itilId={id} items={timelineItems} />

      <CostsSection itilType="change" itilId={id} costs={costs} />
    </div>
  );
}
