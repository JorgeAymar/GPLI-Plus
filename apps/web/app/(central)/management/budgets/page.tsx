import { requireAuthContext } from "@/lib/session";
import { listBudgets } from "@itsm/core";
import { BudgetForm } from "./budget-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Presupuestos" };

export default async function BudgetsPage() {
  const context = await requireAuthContext();
  const budgets = await listBudgets(context.activeEntity.id, { includeSubtree: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Presupuestos</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {budgets.map((b) => (
              <li key={b.id} className="text-sm">
                {b.name} <span className="opacity-40">(${(b.amountCents / 100).toFixed(2)})</span>
              </li>
            ))}
            {budgets.length === 0 ? <li className="text-sm opacity-50">Sin presupuestos todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo presupuesto</h2>
          <BudgetForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}
