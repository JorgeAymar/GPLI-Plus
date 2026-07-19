import { updateProblemStatusAction } from "@/actions/problems.actions";
import { ActorsSection } from "@/components/itil/actors-section";
import { CostsSection } from "@/components/itil/costs-section";
import { StatusSelect } from "@/components/itil/status-select";
import { TimelineSection } from "@/components/itil/timeline-section";
import { ValidationsSection } from "@/components/itil/validations-section";
import { getProblem, listActors, listCosts, listTimelineItems, listUsers, listValidations } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const problem = await getProblem(id);
  return { title: problem?.title ?? "Problema" };
}

export default async function ProblemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const problem = await getProblem(id);
  if (!problem) notFound();

  const [actors, timelineItems, validations, costs, users] = await Promise.all([
    listActors("problem", id),
    listTimelineItems("problem", id),
    listValidations("problem", id),
    listCosts("problem", id),
    listUsers(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{problem.title}</h1>
        <StatusSelect id={problem.id} currentStatus={problem.status} updateStatusAction={updateProblemStatusAction} />
      </div>
      <p className="whitespace-pre-wrap text-sm opacity-80">{problem.content}</p>
      <p className="text-sm opacity-60">
        Urgencia: {problem.urgency} · Impacto: {problem.impact} · Prioridad: {problem.priority}
      </p>

      <div className="grid grid-cols-2 gap-8">
        <ActorsSection itilType="problem" itilId={id} actors={actors} users={users} />
        <ValidationsSection itilType="problem" itilId={id} validations={validations} users={users} />
      </div>

      <TimelineSection itilType="problem" itilId={id} items={timelineItems} />

      <CostsSection itilType="problem" itilId={id} costs={costs} />
    </div>
  );
}
