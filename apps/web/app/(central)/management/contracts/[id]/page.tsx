import { requireAuthContext } from "@/lib/session";
import { getContract, listAssets, listAssetsForContract } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkAssetForm } from "./link-asset-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const contract = await getContract(id);
  return { title: contract?.name ?? "Contrato" };
}

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAuthContext();

  const contract = await getContract(id);
  if (!contract) notFound();

  const [linkedAssets, allAssets] = await Promise.all([
    listAssetsForContract(id),
    listAssets(context.activeEntity.id, { includeSubtree: true }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{contract.name}</h1>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <dt className="opacity-60">Tipo</dt>
        <dd>{contract.contractType}</dd>
        <dt className="opacity-60">Facturación</dt>
        <dd>{contract.billingFrequency}</dd>
        <dt className="opacity-60">Costo</dt>
        <dd>{contract.costCents ? `$${(contract.costCents / 100).toFixed(2)}` : "-"}</dd>
      </dl>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Activos cubiertos</h2>
          <ul className="space-y-1">
            {linkedAssets.map((a) => (
              <li key={a.id} className="text-sm">
                {a.name}
              </li>
            ))}
            {linkedAssets.length === 0 ? <li className="text-sm opacity-50">Sin activos vinculados.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Vincular activo</h2>
          <LinkAssetForm contractId={id} assets={allAssets} />
        </div>
      </div>
    </div>
  );
}
