import { requireAuthContext } from "@/lib/session";
import { getSlaComplianceRate, MODULE, requireRight, RIGHT } from "@itsm/core";

const DAYS = 30;

export default async function SlaComplianceReportPage() {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSISTANCE_TICKET, RIGHT.READ);

  const { total, breached, complianceRate } = await getSlaComplianceRate(context.activeEntity.id, {
    includeSubtree: true,
    days: DAYS,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Cumplimiento de SLA</h1>
      <p className="text-sm opacity-70">Asignaciones SLA de tickets con vencimiento en los últimos {DAYS} días.</p>

      <dl className="grid max-w-md grid-cols-2 gap-y-3 text-sm">
        <dt className="opacity-60">Total de asignaciones</dt>
        <dd className="text-right font-medium">{total}</dd>

        <dt className="opacity-60">Incumplidas</dt>
        <dd className="text-right font-medium">{breached}</dd>

        <dt className="opacity-60">Cumplimiento</dt>
        <dd className="text-right font-medium">{(complianceRate * 100).toFixed(1)}%</dd>
      </dl>
    </div>
  );
}
