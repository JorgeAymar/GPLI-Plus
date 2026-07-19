"use client";

import { updateTicketAction } from "@/actions/tickets.actions";
import { useFormSuccessToast } from "@/components/toast";
import type { Ticket } from "@itsm/db";
import { useActionState, useRef } from "react";

interface FormState {
  error?: string;
}

const LEVELS = [1, 2, 3, 4, 5];

function makeAction(ticketId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await updateTicketAction(ticketId, {
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        urgency: Number(formData.get("urgency")),
        impact: Number(formData.get("impact")),
        priority: Number(formData.get("priority")),
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function TicketEditForm({ ticket }: { ticket: Ticket }) {
  const [state, formAction, isPending] = useActionState(makeAction(ticket.id), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useFormSuccessToast(state, formRef, "Ticket actualizado.");
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    // Keyed on the editable fields so a successful edit - which changes these
    // fields and triggers revalidatePath - remounts just this <form> to pick
    // up fresh `defaultValue`s from the server. The key lives on the <form>
    // itself rather than on <TicketEditForm> in page.tsx so that remount
    // doesn't tear down this component's `useActionState`/toast state in the
    // same commit the refreshed data lands in (that ordering silently
    // swallows the success toast - confirmed empirically; see the identical
    // pattern in asset-edit-form.tsx for the full rationale).
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      key={`${ticket.title}-${ticket.content}-${ticket.urgency}-${ticket.impact}-${ticket.priority}`}
    >
      <div>
        <label htmlFor="ticket-edit-title" className="text-sm font-medium">Título</label>
        <input id="ticket-edit-title" name="title" required defaultValue={ticket.title} className={inputClass} />
      </div>
      <div>
        <label htmlFor="ticket-edit-content" className="text-sm font-medium">Descripción</label>
        <textarea
          id="ticket-edit-content"
          name="content"
          required
          rows={4}
          defaultValue={ticket.content}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="ticket-edit-urgency" className="text-sm font-medium">Urgencia</label>
          <select
            id="ticket-edit-urgency"
            name="urgency"
            defaultValue={ticket.urgency}
            required
            className={inputClass}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ticket-edit-impact" className="text-sm font-medium">Impacto</label>
          <select id="ticket-edit-impact" name="impact" defaultValue={ticket.impact} required className={inputClass}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ticket-edit-priority" className="text-sm font-medium">Prioridad</label>
          <select
            id="ticket-edit-priority"
            name="priority"
            defaultValue={ticket.priority}
            required
            className={inputClass}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
