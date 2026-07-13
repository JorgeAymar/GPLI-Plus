"use client";

import { createSoftwareLicenseAction } from "@/actions/software.actions";
import type { SoftwareVersion } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

const LICENSE_TYPES = ["per_seat", "per_device", "volume", "subscription", "oem", "freeware"] as const;

function makeAction(entityId: string, softwareId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const seatsTotalRaw = formData.get("seatsTotal") as string;
      await createSoftwareLicenseAction({
        entityId,
        softwareId,
        softwareVersionId: (formData.get("softwareVersionId") as string) || null,
        name: formData.get("name") as string,
        licenseType: formData.get("licenseType") as (typeof LICENSE_TYPES)[number],
        serialNumber: (formData.get("serialNumber") as string) || null,
        seatsTotal: seatsTotalRaw ? Number(seatsTotalRaw) : null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function SoftwareLicenseForm({
  entityId,
  softwareId,
  versions,
}: {
  entityId: string;
  softwareId: string;
  versions: SoftwareVersion[];
}) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId, softwareId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="software-license-name" className="text-sm font-medium">Nombre</label>
        <input id="software-license-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="software-license-type" className="text-sm font-medium">Tipo de licencia</label>
        <select id="software-license-type" name="licenseType" className={inputClass}>
          {LICENSE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="software-license-version" className="text-sm font-medium">Versión (opcional)</label>
        <select id="software-license-version" name="softwareVersionId" className={inputClass}>
          <option value="">(cualquiera)</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="software-license-seats-total" className="text-sm font-medium">Asientos totales</label>
          <input id="software-license-seats-total" name="seatsTotal" type="number" min={0} placeholder="ilimitado" className={inputClass} />
        </div>
        <div>
          <label htmlFor="software-license-serial-number" className="text-sm font-medium">Número de serie</label>
          <input id="software-license-serial-number" name="serialNumber" className={inputClass} />
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear licencia"}
      </button>
    </form>
  );
}
