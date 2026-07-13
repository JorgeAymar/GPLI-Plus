import type { ItilCost, ItilType } from "@itsm/db";
import { CostForm } from "./cost-form";

export function CostsSection({ itilType, itilId, costs }: { itilType: ItilType; itilId: string; costs: ItilCost[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium opacity-70">Costos</h2>
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
