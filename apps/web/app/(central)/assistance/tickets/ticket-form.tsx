"use client";

import { createTicketAction } from "@/actions/tickets.actions";
import type { DropdownItem, TicketFieldDefinition } from "@itsm/db";
import { useActionState, useState } from "react";

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

/** Fields visible for a given ticketType: those pinned to it plus the ones that apply to both (ticketType === null). */
function fieldsForType(fields: TicketFieldDefinition[], ticketType: string): TicketFieldDefinition[] {
  return fields.filter((f) => f.ticketType === null || f.ticketType === ticketType);
}

function makeAction(entityId: string, fields: TicketFieldDefinition[]) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const ticketType = formData.get("ticketType") as "incident" | "request";
      await createTicketAction({
        entityId,
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        ticketType,
        customFields: buildCustomFields(formData, fieldsForType(fields, ticketType)),
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
        <label className="text-sm font-medium">{field.label}</label>
        <select name={name} required={field.isRequired} className={inputClass}>
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
        <label className="text-sm font-medium">{field.label}</label>
        <textarea name={name} required={field.isRequired} className={inputClass} />
      </div>
    );
  }

  const inputType = field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text";
  return (
    <div>
      <label className="text-sm font-medium">{field.label}</label>
      <input name={name} type={inputType} required={field.isRequired} className={inputClass} />
    </div>
  );
}

export function TicketForm({
  entityId,
  fields,
  dropdownOptions,
}: {
  entityId: string;
  fields: TicketFieldDefinition[];
  dropdownOptions: Record<string, DropdownItem[]>;
}) {
  const [ticketType, setTicketType] = useState<"incident" | "request">("incident");
  const [state, formAction, isPending] = useActionState(makeAction(entityId, fields), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";
  const visibleFields = fieldsForType(fields, ticketType);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Tipo</label>
        <select
          name="ticketType"
          value={ticketType}
          onChange={(e) => setTicketType(e.target.value as "incident" | "request")}
          className={inputClass}
        >
          <option value="incident">Incidente</option>
          <option value="request">Solicitud</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Título</label>
        <input name="title" required className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Descripción</label>
        <textarea name="content" required rows={4} className={inputClass} />
      </div>
      {visibleFields.map((field) => (
        <DynamicField key={field.id} field={field} options={dropdownOptions[field.key] ?? []} />
      ))}
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear ticket"}
      </button>
    </form>
  );
}
