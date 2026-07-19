import { requireAuthContext } from "@/lib/session";
import { DROPDOWN_CATEGORY, getDropdownCategoryByKey, listDropdownItems, listNetworkEquipment } from "@itsm/core";
import { NetworkEquipmentForm } from "./network-equipment-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Equipos de red" };

export default async function NetworkEquipmentPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const context = await requireAuthContext();

  const allEquipment = await listNetworkEquipment(context.activeEntity.id, { includeSubtree: true });
  const equipment = q
    ? allEquipment.filter((e) => {
        const needle = q.toLowerCase();
        return (
          e.name.toLowerCase().includes(needle) ||
          (e.serialNumber ?? "").toLowerCase().includes(needle) ||
          (e.inventoryNumber ?? "").toLowerCase().includes(needle)
        );
      })
    : allEquipment;

  const deviceTypeCategory = await getDropdownCategoryByKey(DROPDOWN_CATEGORY.NETWORK_EQUIPMENT_TYPE);
  const deviceTypeOptions = deviceTypeCategory ? await listDropdownItems(deviceTypeCategory.id, context.activeEntity.id) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Equipos de red</h1>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre, serie o inventario..."
          className="w-full max-w-md rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
        <button type="submit" className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          Buscar
        </button>
      </form>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {equipment.map((e) => (
              <li key={e.id} className="text-sm">
                {e.name} {e.ipAddress ? <span className="opacity-40">({e.ipAddress})</span> : null}
              </li>
            ))}
            {equipment.length === 0 ? <li className="text-sm opacity-50">Sin equipos todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo equipo de red</h2>
          <NetworkEquipmentForm entityId={context.activeEntity.id} deviceTypeOptions={deviceTypeOptions} />
        </div>
      </div>
    </div>
  );
}
