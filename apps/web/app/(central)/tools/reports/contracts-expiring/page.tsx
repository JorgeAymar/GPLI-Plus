import { requireAuthContext } from "@/lib/session";
import { getContractsExpiringReport, MODULE, requireRight, RIGHT } from "@itsm/core";

const DEFAULT_DAYS = 30;

export default async function ContractsExpiringReportPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  const parsedDays = Number(days);
  const withinDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : DEFAULT_DAYS;

  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CONTRACT, RIGHT.READ);

  const contracts = await getContractsExpiringReport(context.activeEntity.id, withinDays, { includeSubtree: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Contratos por vencer</h1>

      <form className="flex items-center gap-2">
        <label htmlFor="days" className="text-sm opacity-70">
          Próximos
        </label>
        <input
          id="days"
          name="days"
          type="number"
          min={1}
          defaultValue={withinDays}
          className="w-20 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
        <span className="text-sm opacity-70">días (por defecto, para contratos sin aviso propio configurado)</span>
        <button type="submit" className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          Aplicar
        </button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-60">
            <th className="pb-2">Nombre</th>
            <th className="pb-2">Tipo</th>
            <th className="pb-2">Vence</th>
            <th className="pb-2">Aviso (días)</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <tr key={c.id} className="border-t border-black/5 dark:border-white/5">
              <td className="py-2">{c.name}</td>
              <td className="py-2 opacity-70">{c.contractType}</td>
              <td className="py-2 opacity-70">{c.endDate ? new Date(c.endDate).toLocaleDateString() : "-"}</td>
              <td className="py-2 opacity-70">{c.renewalNoticeDays ?? `${withinDays} (por defecto)`}</td>
            </tr>
          ))}
          {contracts.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-2 opacity-50">
                Sin contratos por vencer en este rango.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
