"use client";

import { createWebhookAction } from "@/actions/webhooks.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const maxRetriesRaw = formData.get("maxRetries") as string;
  const result = await createWebhookAction({
    entityId: formData.get("entityId") as string,
    name: formData.get("name") as string,
    itemType: formData.get("itemType") as string,
    event: formData.get("event") as "create" | "update" | "delete",
    url: formData.get("url") as string,
    secret: formData.get("secret") as string,
    maxRetries: maxRetriesRaw ? Number(maxRetriesRaw) : undefined,
  });
  return result.error ? { error: result.error } : {};
}

export function WebhookForm({ entityId }: { entityId: string }) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="entityId" value={entityId} />
      <div>
        <label htmlFor="webhook-name" className="text-sm font-medium">Nombre</label>
        <input id="webhook-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="webhook-item-type" className="text-sm font-medium">Tipo de item</label>
        <input id="webhook-item-type" name="itemType" required placeholder="ticket" className={inputClass} />
      </div>
      <div>
        <label htmlFor="webhook-event" className="text-sm font-medium">Evento</label>
        <select id="webhook-event" name="event" required defaultValue="create" className={inputClass}>
          <option value="create">create</option>
          <option value="update">update</option>
          <option value="delete">delete</option>
        </select>
      </div>
      <div>
        <label htmlFor="webhook-url" className="text-sm font-medium">URL de destino</label>
        <input id="webhook-url" name="url" type="url" required placeholder="https://ejemplo.com/webhook" className={inputClass} />
      </div>
      <div>
        <label htmlFor="webhook-secret" className="text-sm font-medium">Secreto (mín. 8 caracteres, firma HMAC-SHA256)</label>
        <input id="webhook-secret" name="secret" required minLength={8} className={inputClass} />
      </div>
      <div>
        <label htmlFor="webhook-max-retries" className="text-sm font-medium">Reintentos máximos (opcional, por defecto 3)</label>
        <input id="webhook-max-retries" name="maxRetries" type="number" min={1} className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear webhook"}
      </button>
    </form>
  );
}
