"use client";

import { createRecurringTicketTemplateAction } from "@/actions/recurring-tickets.actions";
import type { User } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createRecurringTicketTemplateAction({
        entityId,
        name: formData.get("name") as string,
        titleTemplate: formData.get("titleTemplate") as string,
        contentTemplate: formData.get("contentTemplate") as string,
        requesterUserId: formData.get("requesterUserId") as string,
        intervalMinutes: Number(formData.get("intervalMinutes")),
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function RecurringTicketForm({ entityId, users }: { entityId: string; users: User[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="recurring-ticket-name" className="text-sm font-medium">Nombre</label>
        <input id="recurring-ticket-name" name="name" required placeholder="Revisión semanal de backups" className={inputClass} />
      </div>
      <div>
        <label htmlFor="recurring-ticket-title-template" className="text-sm font-medium">Título del ticket generado</label>
        <input id="recurring-ticket-title-template" name="titleTemplate" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="recurring-ticket-content-template" className="text-sm font-medium">Descripción del ticket generado</label>
        <textarea id="recurring-ticket-content-template" name="contentTemplate" required rows={3} className={inputClass} />
      </div>
      <div>
        <label htmlFor="recurring-ticket-requester" className="text-sm font-medium">Solicitante</label>
        <select id="recurring-ticket-requester" name="requesterUserId" required className={inputClass}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="recurring-ticket-interval" className="text-sm font-medium">Repetir cada (minutos)</label>
        <input id="recurring-ticket-interval" name="intervalMinutes" type="number" min={1} required placeholder="10080 = semanal" className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear recurrencia"}
      </button>
    </form>
  );
}
