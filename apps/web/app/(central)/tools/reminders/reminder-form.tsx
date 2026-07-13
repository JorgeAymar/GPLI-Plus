"use client";

import { createReminderAction } from "@/actions/reminders.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

export function ReminderForm({ entityId }: { entityId: string }) {
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
    try {
      const remindAtRaw = formData.get("remindAt") as string;
      const contentRaw = formData.get("content") as string;
      await createReminderAction({
        entityId,
        title: formData.get("title") as string,
        content: contentRaw ? contentRaw : null,
        remindAt: remindAtRaw ? remindAtRaw : null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  }

  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Título</label>
        <input name="title" required className={inputClass} placeholder="ej. Llamar al proveedor" />
      </div>
      <div>
        <label className="text-sm font-medium">Contenido</label>
        <textarea name="content" rows={3} className={inputClass} placeholder="Notas opcionales" />
      </div>
      <div>
        <label className="text-sm font-medium">Recordar el</label>
        <input type="datetime-local" name="remindAt" className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear recordatorio"}
      </button>
    </form>
  );
}
