import type { ItilCost, ItilType } from "@itsm/db";
import { CostForm } from "./cost-form";

export function CostsSection({ itilType, itilId, costs }: { itilType: ItilType; itilId: string; costs: ItilCost[] }) {
  const totalCents = costs.reduce((sum, c) => sum + c.amountCents, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium opacity-70">Costos</h2>
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
