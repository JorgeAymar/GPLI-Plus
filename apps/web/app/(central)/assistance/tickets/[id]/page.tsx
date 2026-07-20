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
  DROPDOWN_CATEGORY,
  getDropdownCategoryByKey,
  getTicket,
  listActors,
  listCosts,
  listDropdownItems,
  listSlaAssignments,
  listSlaPolicies,
  listTimelineItems,
  listUsers,
  listValidations,
} from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketEditForm } from "./ticket-edit-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ticket = await getTicket(id);
  return { title: ticket?.title ?? "Ticket" };
}

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

  // itil_category is the shared category dropdown for tickets/problems/changes (see seed.ts
  // and the identical fetch in ../page.tsx's "Nuevo ticket" form).
  const categoryCategory = await getDropdownCategoryByKey(DROPDOWN_CATEGORY.ITIL_CATEGORY);
  const categoryOptions = categoryCategory ? await listDropdownItems(categoryCategory.id, context.activeEntity.id) : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{ticket.title}</h1>
        <StatusSelect id={ticket.id} currentStatus={ticket.status} updateStatusAction={updateTicketStatusAction} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Editar ticket</h2>
        <TicketEditForm ticket={ticket} categoryOptions={categoryOptions} />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
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
