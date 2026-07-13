import { requireAuthContext } from "@/lib/session";
import { getTicketCountsByStatus, MODULE, requireRight, RIGHT } from "@itsm/core";

// Same labels used in app/(central)/assistance/tickets/page.tsx.
const STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  assigned: "Asignado",
  planned: "Planificado",
  pending: "Pendiente",
  solved: "Resuelto",
  closed: "Cerrado",
};

export default async function TicketsByStatusReportPage() {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_TICKET, RIGHT.READ);

  const rows = await getTicketCountsByStatus(context.activeEntity.id, { includeSubtree: true });
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tickets por estado</h1>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-60">
            <th className="pb-2">Estado</th>
            <th className="pb-2">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.status} className="border-t border-black/5 dark:border-white/5">
              <td className="py-2">{STATUS_LABELS[r.status] ?? r.status}</td>
              <td className="py-2 opacity-70">{r.count}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-2 opacity-50">
                Sin tickets todavía.
              </td>
            </tr>
          ) : null}
        </tbody>
        {rows.length > 0 ? (
          <tfoot>
            <tr className="border-t border-black/10 font-medium dark:border-white/10">
              <td className="py-2">Total</td>
              <td className="py-2">{total}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
