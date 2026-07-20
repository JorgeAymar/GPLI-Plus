import { requireAuthContext } from "@/lib/session";
import { countAvailable, isBelowAlertThreshold, listConsumableItems, listSuppliers } from "@itsm/core";
import Link from "next/link";
import { ConsumableItemForm } from "./consumable-item-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Consumibles" };

export default async function ConsumablesPage() {
  const context = await requireAuthContext();
  const [items, suppliers] = await Promise.all([
    listConsumableItems(context.activeEntity.id, { includeSubtree: true }),
    listSuppliers(context.activeEntity.id, { includeSubtree: true }),
  ]);

  const itemsWithStock = await Promise.all(
    items.map(async (item) => ({
      item,
      available: await countAvailable(item.id),
      belowThreshold: await isBelowAlertThreshold(item.id),
    })),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Consumibles</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Existentes</h2>
          <ul className="space-y-1">
            {itemsWithStock.map(({ item, available, belowThreshold }) => (
              <li key={item.id} className="text-sm">
                <Link href={`/management/consumables/${item.id}`} className="hover:underline">
                  {item.name}
                </Link>{" "}
                <span className="opacity-40">({available} disponibles)</span>
                {belowThreshold ? <span className="ml-2 font-medium text-red-600">Bajo stock</span> : null}
              </li>
            ))}
            {itemsWithStock.length === 0 ? <li className="text-sm opacity-50">Sin consumibles todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-60">Nuevo consumible</h2>
          <ConsumableItemForm entityId={context.activeEntity.id} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
        </div>
      </div>
    </div>
  );
}
