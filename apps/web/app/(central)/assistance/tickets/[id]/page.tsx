import { updateTicketStatusAction } from "@/actions/tickets.actions";
import { requireAuthContext } from "@/lib/session";
import { ActorsSection } from "@/components/itil/actors-section";
import { AttachmentsSection } from "@/components/documents/attachments-section";
import { CostsSection } from "@/components/itil/costs-section";
import { SlaSection } from "@/components/itil/sla-section";
import { StatusSelect } from "@/components/itil/status-select";
import { TimelineSection } from "@/components/itil/timeline-section";
import { ValidationsSection } from "@/components/itil/validations-section";
import {
  getTicket,
  listActors,
  listCosts,
  listSlaAssignments,
  listSlaPolicies,
  listTimelineItems,
  listUsers,
  listValidations,
} from "@itsm/core";
import { notFound } from "next/navigation";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAuthContext();

  const ticket = await getTicket(id);
  if (!ticket) notFound();

  const [actors, timelineItems, validations, costs, users, slaAssignments, slaPolicies] = await Promise.all([
    listActors("ticket", id),
    listTimelineItems("ticket", id),
    listValidations("ticket", id),
    listCosts("ticket", id),
    listUsers(),
    listSlaAssignments("ticket", id),
    listSlaPolicies(context.activeEntity.id, { includeSubtree: true }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{ticket.title}</h1>
        <StatusSelect id={ticket.id} currentStatus={ticket.status} updateStatusAction={updateTicketStatusAction} />
      </div>
      <p className="whitespace-pre-wrap text-sm opacity-80">{ticket.content}</p>

      <div className="grid grid-cols-2 gap-8">
        <ActorsSection itilType="ticket" itilId={id} actors={actors} users={users} />
        <ValidationsSection itilType="ticket" itilId={id} validations={validations} users={users} />
      </div>

      <SlaSection itilType="ticket" itilId={id} assignments={slaAssignments} policies={slaPolicies} />

      <TimelineSection itilType="ticket" itilId={id} items={timelineItems} />

      <CostsSection itilType="ticket" itilId={id} costs={costs} />

      <AttachmentsSection itemType="ticket" itemId={id} revalidatePathTarget={`/assistance/tickets/${id}`} />
    </div>
  );
}
