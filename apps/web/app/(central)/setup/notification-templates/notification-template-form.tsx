"use client";

import { createNotificationTemplateAction } from "@/actions/notification-templates.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    await createNotificationTemplateAction({
      key: formData.get("key") as string,
      name: formData.get("name") as string,
      subjectTemplate: formData.get("subjectTemplate") as string,
      bodyTemplate: formData.get("bodyTemplate") as string,
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function NotificationTemplateForm() {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="notification-template-key" className="text-sm font-medium">Clave (key)</label>
        <input id="notification-template-key" name="key" required placeholder="ticket_solved" className={inputClass} />
      </div>
      <div>
        <label htmlFor="notification-template-name" className="text-sm font-medium">Nombre</label>
        <input id="notification-template-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="notification-template-subject" className="text-sm font-medium">Asunto (soporta {"{{placeholders}}"})</label>
        <input id="notification-template-subject" name="subjectTemplate" required placeholder="Tu ticket {{ticketTitle}} fue resuelto" className={inputClass} />
      </div>
      <div>
        <label htmlFor="notification-template-body" className="text-sm font-medium">Cuerpo</label>
        <textarea id="notification-template-body" name="bodyTemplate" required rows={4} className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear plantilla"}
      </button>
    </form>
  );
}
