import { requireAuthContext } from "@/lib/session";
import { listRecurringTicketTemplates, listUsers } from "@itsm/core";
import { RecurringTicketForm } from "./recurring-ticket-form";

export default async function RecurringTicketsPage() {
  const context = await requireAuthContext();
  const [templates, users] = await Promise.all([
    listRecurringTicketTemplates(context.activeEntity.id, { includeSubtree: true }),
    listUsers(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tickets recurrentes</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {templates.map((t) => (
              <li key={t.id} className="text-sm">
                {t.name} <span className="opacity-40">(cada {t.intervalMinutes} min, próximo: {t.nextRunAt.toLocaleString()})</span>
              </li>
            ))}
            {templates.length === 0 ? <li className="text-sm opacity-50">Sin recurrencias todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nueva recurrencia</h2>
          <RecurringTicketForm entityId={context.activeEntity.id} users={users} />
        </div>
      </div>
    </div>
  );
}
