import { requireAuthContext } from "@/lib/session";
import { getYearlyAssetsReport, MODULE, requireRight, RIGHT } from "@itsm/core";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Altas de activos por año" };

export default async function YearlyAssetsReportPage() {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSETS_GENERIC, RIGHT.READ);

  const rows = await getYearlyAssetsReport(context.activeEntity.id, { includeSubtree: true });
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Altas de activos por año</h1>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-60">
            <th className="pb-2">Año</th>
            <th className="pb-2">Altas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year} className="border-t border-black/5 dark:border-white/5">
              <td className="py-2">{r.year}</td>
              <td className="py-2 opacity-70">{r.count}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-2 opacity-50">
                Sin activos todavía.
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
