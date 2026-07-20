import { updateProblemStatusAction } from "@/actions/problems.actions";
import { ActorsSection } from "@/components/itil/actors-section";
import { CostsSection } from "@/components/itil/costs-section";
import { StatusSelect } from "@/components/itil/status-select";
import { TimelineSection } from "@/components/itil/timeline-section";
import { ValidationsSection } from "@/components/itil/validations-section";
import { getProblem, listActors, listCosts, listTimelineItems, listUsers, listValidations } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProblemEditForm } from "./problem-edit-form";

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

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Editar problema</h2>
        <ProblemEditForm problem={problem} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-8">
          <TimelineSection itilType="problem" itilId={id} items={timelineItems} />

          <CostsSection itilType="problem" itilId={id} costs={costs} />
        </div>

        <div className="flex flex-col gap-8 lg:col-span-4">
          <ActorsSection itilType="problem" itilId={id} actors={actors} users={users} />

          <ValidationsSection itilType="problem" itilId={id} validations={validations} users={users} />
        </div>
      </div>
    </div>
  );
}
