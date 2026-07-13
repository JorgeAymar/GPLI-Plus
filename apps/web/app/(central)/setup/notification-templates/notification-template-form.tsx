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
        <label className="text-sm font-medium">Clave (key)</label>
        <input name="key" required placeholder="ticket_solved" className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Nombre</label>
        <input name="name" required className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Asunto (soporta {"{{placeholders}}"})</label>
        <input name="subjectTemplate" required placeholder="Tu ticket {{ticketTitle}} fue resuelto" className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Cuerpo</label>
        <textarea name="bodyTemplate" required rows={4} className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear plantilla"}
      </button>
    </form>
  );
}
