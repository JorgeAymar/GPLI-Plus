import { requireAuthContext } from "@/lib/session";
import { getTicketsCreatedByDay, MODULE, requireRight, RIGHT } from "@itsm/core";

const DAYS = 30;

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tickets creados por día" };

export default async function TicketsCreatedByDayReportPage() {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_TICKET, RIGHT.READ);

  const rows = await getTicketsCreatedByDay(context.activeEntity.id, { includeSubtree: true, days: DAYS });
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tickets creados por día</h1>
      <p className="text-sm opacity-70">Últimos {DAYS} días.</p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-60">
            <th className="pb-2">Fecha</th>
            <th className="pb-2">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="border-t border-black/5 dark:border-white/5">
              <td className="py-2">{r.date}</td>
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
