"use client";

import { createNetworkEquipmentAction } from "@/actions/network-equipment.actions";
import type { DropdownItem } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const portsCountRaw = formData.get("portsCount") as string;
      await createNetworkEquipmentAction({
        entityId,
        name: formData.get("name") as string,
        serialNumber: (formData.get("serialNumber") as string) || null,
        inventoryNumber: (formData.get("inventoryNumber") as string) || null,
        ipAddress: (formData.get("ipAddress") as string) || null,
        macAddress: (formData.get("macAddress") as string) || null,
        deviceTypeDropdownItemId: (formData.get("deviceTypeDropdownItemId") as string) || null,
        firmwareVersion: (formData.get("firmwareVersion") as string) || null,
        portsCount: portsCountRaw ? Number(portsCountRaw) : null,
        comment: (formData.get("comment") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function NetworkEquipmentForm({ entityId, deviceTypeOptions }: { entityId: string; deviceTypeOptions: DropdownItem[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="network-equipment-name" className="text-sm font-medium">Nombre</label>
        <input id="network-equipment-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="network-equipment-device-type" className="text-sm font-medium">Tipo de equipo</label>
        <select id="network-equipment-device-type" name="deviceTypeDropdownItemId" className={inputClass}>
          <option value="">(ninguno)</option>
          {deviceTypeOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="network-equipment-ip" className="text-sm font-medium">IP</label>
          <input id="network-equipment-ip" name="ipAddress" placeholder="192.168.1.1" className={inputClass} />
        </div>
        <div>
          <label htmlFor="network-equipment-mac" className="text-sm font-medium">MAC</label>
          <input id="network-equipment-mac" name="macAddress" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="network-equipment-firmware" className="text-sm font-medium">Firmware</label>
          <input id="network-equipment-firmware" name="firmwareVersion" className={inputClass} />
        </div>
        <div>
          <label htmlFor="network-equipment-ports" className="text-sm font-medium">Puertos</label>
          <input id="network-equipment-ports" name="portsCount" type="number" min={0} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="network-equipment-serial-number" className="text-sm font-medium">Número de serie</label>
        <input id="network-equipment-serial-number" name="serialNumber" className={inputClass} />
      </div>
      <div>
        <label htmlFor="network-equipment-comment" className="text-sm font-medium">Comentario</label>
        <textarea id="network-equipment-comment" name="comment" className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear equipo de red"}
      </button>
    </form>
  );
}
