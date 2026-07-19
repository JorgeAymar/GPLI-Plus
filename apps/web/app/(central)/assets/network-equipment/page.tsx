import { requireAuthContext } from "@/lib/session";
import { DROPDOWN_CATEGORY, getDropdownCategoryByKey, listDropdownItems, listNetworkEquipment } from "@itsm/core";
import { NetworkEquipmentForm } from "./network-equipment-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Equipos de red" };

export default async function NetworkEquipmentPage() {
  const context = await requireAuthContext();

  const equipment = await listNetworkEquipment(context.activeEntity.id, { includeSubtree: true });

  const deviceTypeCategory = await getDropdownCategoryByKey(DROPDOWN_CATEGORY.NETWORK_EQUIPMENT_TYPE);
  const deviceTypeOptions = deviceTypeCategory ? await listDropdownItems(deviceTypeCategory.id, context.activeEntity.id) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Equipos de red</h1>
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
