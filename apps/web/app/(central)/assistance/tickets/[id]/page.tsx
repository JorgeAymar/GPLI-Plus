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

      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Editar ticket</h2>
        <TicketEditForm ticket={ticket} categoryOptions={categoryOptions} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-8">
          <TimelineSection itilType="ticket" itilId={id} items={timelineItems} />

          <CostsSection itilType="ticket" itilId={id} costs={costs} />
        </div>

        <div className="flex flex-col gap-8 lg:col-span-4">
          <ActorsSection itilType="ticket" itilId={id} actors={actors} users={users} />

          <ValidationsSection itilType="ticket" itilId={id} validations={validations} users={users} />

          <SlaSection itilType="ticket" itilId={id} assignments={slaAssignments} policies={slaPolicies} />

          <AttachmentsSection itemType="ticket" itemId={id} revalidatePathTarget={`/assistance/tickets/${id}`} />
        </div>
      </div>
    </div>
  );
}
