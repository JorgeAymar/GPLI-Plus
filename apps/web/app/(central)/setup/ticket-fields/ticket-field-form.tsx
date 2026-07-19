"use client";

import { createTicketFieldDefinitionAction } from "@/actions/ticket-fields.actions";
import type { DropdownCategory } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

const FIELD_TYPES = ["text", "textarea", "number", "boolean", "date", "dropdown"] as const;

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    const fieldType = formData.get("fieldType") as (typeof FIELD_TYPES)[number];
    const ticketTypeRaw = formData.get("ticketType") as string;
    await createTicketFieldDefinitionAction({
      ticketType: ticketTypeRaw === "" ? null : ticketTypeRaw,
      key: formData.get("key") as string,
      label: formData.get("label") as string,
      fieldType,
      dropdownCategoryId: fieldType === "dropdown" ? (formData.get("dropdownCategoryId") as string) || null : null,
      isRequired: formData.get("isRequired") === "on",
      sortOrder: Number(formData.get("sortOrder")) || 0,
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function TicketFieldForm({ dropdownCategories }: { dropdownCategories: DropdownCategory[] }) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="ticket-field-ticket-type" className="text-sm font-medium">Tipo de ticket</label>
        <select id="ticket-field-ticket-type" name="ticketType" className={inputClass}>
          <option value="">(ambos)</option>
          <option value="incident">Incidente</option>
          <option value="request">Solicitud</option>
        </select>
      </div>
      <div>
        <label htmlFor="ticket-field-key" className="text-sm font-medium">Clave (key)</label>
        <input id="ticket-field-key" name="key" required placeholder="urgencia_negocio" className={inputClass} />
      </div>
      <div>
        <label htmlFor="ticket-field-label" className="text-sm font-medium">Etiqueta</label>
        <input id="ticket-field-label" name="label" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="ticket-field-type" className="text-sm font-medium">Tipo de dato</label>
        <select id="ticket-field-type" name="fieldType" className={inputClass}>
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="ticket-field-dropdown-category" className="text-sm font-medium">Categoría de lista (solo si tipo = dropdown)</label>
        <select id="ticket-field-dropdown-category" name="dropdownCategoryId" className={inputClass}>
          <option value="">(ninguna)</option>
          {dropdownCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="ticket-field-sort-order" className="text-sm font-medium">Orden</label>
        <input id="ticket-field-sort-order" name="sortOrder" type="number" defaultValue={0} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isRequired" /> Obligatorio
      </label>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear campo"}
      </button>
    </form>
  );
}
