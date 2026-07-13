"use client";

import { createContractAction } from "@/actions/contracts.actions";
import type { Supplier } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

const CONTRACT_TYPES = ["maintenance", "lease", "license", "support", "other"] as const;
const BILLING_FREQUENCIES = ["monthly", "quarterly", "annual", "one_time"] as const;

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const costRaw = formData.get("cost") as string;
      await createContractAction({
        entityId,
        supplierId: (formData.get("supplierId") as string) || null,
        name: formData.get("name") as string,
        contractType: formData.get("contractType") as (typeof CONTRACT_TYPES)[number],
        billingFrequency: formData.get("billingFrequency") as (typeof BILLING_FREQUENCIES)[number],
        costCents: costRaw ? Math.round(Number(costRaw) * 100) : null,
        startDate: (formData.get("startDate") as string) || null,
        endDate: (formData.get("endDate") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ContractForm({ entityId, suppliers }: { entityId: string; suppliers: Supplier[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="contract-name" className="text-sm font-medium">Nombre</label>
        <input id="contract-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="contract-supplier" className="text-sm font-medium">Proveedor</label>
        <select id="contract-supplier" name="supplierId" className={inputClass}>
          <option value="">(ninguno)</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="contract-type" className="text-sm font-medium">Tipo</label>
          <select id="contract-type" name="contractType" className={inputClass}>
            {CONTRACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contract-billing-frequency" className="text-sm font-medium">Facturación</label>
          <select id="contract-billing-frequency" name="billingFrequency" className={inputClass}>
            {BILLING_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="contract-start-date" className="text-sm font-medium">Inicio</label>
          <input id="contract-start-date" name="startDate" type="date" className={inputClass} />
        </div>
        <div>
          <label htmlFor="contract-end-date" className="text-sm font-medium">Fin</label>
          <input id="contract-end-date" name="endDate" type="date" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="contract-cost" className="text-sm font-medium">Costo</label>
        <input id="contract-cost" name="cost" type="number" step="0.01" min="0" className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear contrato"}
      </button>
    </form>
  );
}
