import { requireAuthContext } from "@/lib/session";
import { countAvailable, getConsumableItem, isBelowAlertThreshold, listAssets, listConsumables } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddUnitsForm } from "./add-units-form";
import { RetireConsumableForm, UseConsumableForm } from "./unit-row-actions";

const STATUS_LABEL: Record<string, string> = {
  new: "Nuevo",
  in_use: "En uso",
  used: "Usado",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getConsumableItem(id);
  return { title: item?.name ?? "Consumible" };
}

export default async function ConsumableItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAuthContext();

  const item = await getConsumableItem(id);
  if (!item) notFound();

  const [units, assets, available, belowThreshold] = await Promise.all([
    listConsumables(id),
    listAssets(context.activeEntity.id, { includeSubtree: true }),
    countAvailable(id),
    isBelowAlertThreshold(id),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{item.name}</h1>

      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Información general</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <dt className="opacity-60">Disponibles</dt>
          <dd>
            {available}
            {belowThreshold ? <span className="ml-2 font-medium text-red-600">Bajo stock</span> : null}
          </dd>
          <dt className="opacity-60">Umbral de alerta</dt>
          <dd>{item.alertThreshold ?? "-"}</dd>
        </dl>
      </div>

      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Agregar unidades</h2>
        <AddUnitsForm consumableItemId={id} />
      </div>

      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Unidades</h2>
        <ul className="space-y-2">
          {units.map((unit) => (
            <li key={unit.id} className="flex items-center justify-between gap-3 border-b border-black/10 pb-2 text-sm dark:border-white/10">
              <span>
                {STATUS_LABEL[unit.status] ?? unit.status}
                {unit.useDate ? <span className="opacity-40"> · usado {new Date(unit.useDate).toLocaleDateString()}</span> : null}
              </span>
              {unit.status === "new" ? <UseConsumableForm consumableId={unit.id} assets={assets} /> : null}
              {unit.status === "in_use" ? <RetireConsumableForm consumableItemId={id} consumableId={unit.id} /> : null}
            </li>
          ))}
          {units.length === 0 ? <li className="text-sm opacity-50">Sin unidades todavía.</li> : null}
        </ul>
      </div>
    </div>
  );
}
