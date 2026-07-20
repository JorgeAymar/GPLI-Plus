import type { ItilCost, ItilType } from "@itsm/db";
import { CostForm } from "./cost-form";

export function CostsSection({ itilType, itilId, costs }: { itilType: ItilType; itilId: string; costs: ItilCost[] }) {
  const totalCents = costs.reduce((sum, c) => sum + c.amountCents, 0);
  return (
    <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
      <div className="mb-4 flex items-baseline justify-between border-b border-black/10 pb-3 dark:border-white/10">
        <h2 className="text-sm font-semibold">Costos</h2>
        {costs.length > 0 ? <span className="text-sm font-medium">Total: ${(totalCents / 100).toFixed(2)}</span> : null}
      </div>
      <ul className="mb-3 space-y-1">
        {costs.map((c) => (
          <li key={c.id} className="text-sm">
            {c.costType} — ${(c.amountCents / 100).toFixed(2)}
          </li>
        ))}
        {costs.length === 0 ? <li className="text-sm opacity-50">Sin costos todavía.</li> : null}
      </ul>
      <CostForm itilType={itilType} itilId={itilId} />
    </div>
  );
}
