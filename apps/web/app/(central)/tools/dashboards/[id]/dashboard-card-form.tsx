"use client";

import { addDashboardCardAction } from "@/actions/dashboards.actions";
import type { CardKey } from "@itsm/core";
import { useActionState } from "react";
import { CARD_KEY_LABEL } from "../card-key-labels";

interface FormState {
  error?: string;
}

function makeAction(dashboardId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const positionX = formData.get("positionX") as string;
      const positionY = formData.get("positionY") as string;
      const width = formData.get("width") as string;
      const height = formData.get("height") as string;
      const chartType = formData.get("chartType") as string;

      await addDashboardCardAction({
        dashboardId,
        cardKey: formData.get("cardKey") as string,
        positionX: positionX ? Number(positionX) : undefined,
        positionY: positionY ? Number(positionY) : undefined,
        width: width ? Number(width) : undefined,
        height: height ? Number(height) : undefined,
        options: chartType ? { chartType } : undefined,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

// availableCardKeys is passed down as a plain-data prop from the Server Component
// page (which imports AVAILABLE_CARD_KEYS from @itsm/core directly) rather than
// imported here as a value - see dashboard-card.tsx's header comment for why a
// Client Component must never value-import anything from @itsm/core (it would
// drag @itsm/db's `db` connection into the browser bundle via report-service.ts).
// `CardKey` itself is fine as a type-only import - it's erased at compile time.
export function DashboardCardForm({ dashboardId, availableCardKeys }: { dashboardId: string; availableCardKeys: CardKey[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(dashboardId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="dashboard-card-key" className="text-sm font-medium">Card</label>
        <select id="dashboard-card-key" name="cardKey" defaultValue={availableCardKeys[0]} className={inputClass}>
          {availableCardKeys.map((key) => (
            <option key={key} value={key}>
              {CARD_KEY_LABEL[key] ?? key}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="dashboard-card-chart-type" className="text-sm font-medium">Tipo de gráfico</label>
        <select id="dashboard-card-chart-type" name="chartType" defaultValue="table" className={inputClass}>
          <option value="table">Tabla</option>
          <option value="bar">Barras</option>
          <option value="pie">Circular</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="dashboard-card-position-x" className="text-sm font-medium">Posición X</label>
          <input id="dashboard-card-position-x" name="positionX" type="number" min={0} defaultValue={0} className={inputClass} />
        </div>
        <div>
          <label htmlFor="dashboard-card-position-y" className="text-sm font-medium">Posición Y</label>
          <input id="dashboard-card-position-y" name="positionY" type="number" min={0} defaultValue={0} className={inputClass} />
        </div>
        <div>
          <label htmlFor="dashboard-card-width" className="text-sm font-medium">Ancho (cols)</label>
          <input id="dashboard-card-width" name="width" type="number" min={1} max={12} defaultValue={4} className={inputClass} />
        </div>
        <div>
          <label htmlFor="dashboard-card-height" className="text-sm font-medium">Alto (filas)</label>
          <input id="dashboard-card-height" name="height" type="number" min={1} defaultValue={3} className={inputClass} />
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "Agregar card"}
      </button>
    </form>
  );
}
