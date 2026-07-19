"use client";

import { createTicketAction } from "@/actions/tickets.actions";
import type { DropdownItem, TicketFieldDefinition } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function buildCustomFields(formData: FormData, fields: TicketFieldDefinition[]): Record<string, unknown> {
  const customFields: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = formData.get(`field_${field.key}`);
    if (field.fieldType === "boolean") {
      customFields[field.key] = raw === "on";
    } else if (raw !== null && raw !== "") {
      customFields[field.key] = raw;
    } else if (field.isRequired) {
      customFields[field.key] = raw;
    }
  }
  return customFields;
}

function makeAction(entityId: string, fields: TicketFieldDefinition[]) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createTicketAction({
        entityId,
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        ticketType: "incident",
        customFields: buildCustomFields(formData, fields),
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

function DynamicField({ field, options }: { field: TicketFieldDefinition; options: DropdownItem[] }) {
  const name = `field_${field.key}`;
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  if (field.fieldType === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={name} required={field.isRequired} />
        {field.label}
      </label>
    );
  }

  if (field.fieldType === "dropdown") {
    return (
      <div>
        <label htmlFor={name} className="text-sm font-medium">
          {field.label}
        </label>
        <select id={name} name={name} required={field.isRequired} className={inputClass}>
          <option value="">(ninguno)</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.fieldType === "textarea") {
    return (
      <div>
        <label htmlFor={name} className="text-sm font-medium">
          {field.label}
        </label>
        <textarea id={name} name={name} required={field.isRequired} className={inputClass} />
      </div>
    );
  }

  const inputType = field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text";
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium">
        {field.label}
      </label>
      <input id={name} name={name} type={inputType} required={field.isRequired} className={inputClass} />
    </div>
  );
}

/** Simplified vs. the Central ticket-form.tsx: no type/priority controls exposed to end users - ticketType is fixed to "incident", so `fields` should already be scoped to that type (see portal-ticket-form.tsx). */
export function PortalTicketFormClient({
  entityId,
  fields,
  dropdownOptions,
}: {
  entityId: string;
  fields: TicketFieldDefinition[];
  dropdownOptions: Record<string, DropdownItem[]>;
}) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId, fields), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="title" className="text-sm font-medium">
          ¿Qué necesitas?
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="Ej: No puedo entrar a mi correo"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="content" className="text-sm font-medium">
          Cuéntanos más
        </label>
        <textarea id="content" name="content" required rows={4} className={inputClass} />
      </div>
      {fields.map((field) => (
        <DynamicField key={field.id} field={field} options={dropdownOptions[field.key] ?? []} />
      ))}
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}
