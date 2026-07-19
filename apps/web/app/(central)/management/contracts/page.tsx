import { requireAuthContext } from "@/lib/session";
import { listContracts, listSuppliers } from "@itsm/core";
import Link from "next/link";
import { ContractForm } from "./contract-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contratos" };

export default async function ContractsPage() {
  const context = await requireAuthContext();
  const [contracts, suppliers] = await Promise.all([
    listContracts(context.activeEntity.id, { includeSubtree: true }),
    listSuppliers(context.activeEntity.id, { includeSubtree: true }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Contratos</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {contracts.map((c) => (
              <li key={c.id}>
                <Link href={`/management/contracts/${c.id}`} className="text-sm hover:underline">
                  {c.name} <span className="opacity-40">({c.contractType})</span>
                </Link>
              </li>
            ))}
            {contracts.length === 0 ? <li className="text-sm opacity-50">Sin contratos todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo contrato</h2>
          <ContractForm entityId={context.activeEntity.id} suppliers={suppliers} />
        </div>
      </div>
    </div>
  );
}
