import { requireAuthContext } from "@/lib/session";
import { getReservationUsageReport, MODULE, requireRight, RIGHT } from "@itsm/core";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Uso de reservas" };

export default async function ReservationsUsageReportPage() {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_RESERVATION, RIGHT.READ);

  const rows = await getReservationUsageReport(context.activeEntity.id, { includeSubtree: true });
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Uso de reservas</h1>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Activo</th>
            <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Reservas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.reservationItemId} className="border-t border-black/5 dark:border-white/5">
              <td className="py-2">{r.assetName}</td>
              <td className="py-2 opacity-70">{r.count}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-2 opacity-50">
                Sin reservas todavía.
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
