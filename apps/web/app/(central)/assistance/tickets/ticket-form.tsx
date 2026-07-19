"use client";

import { createTicketAction } from "@/actions/tickets.actions";
import { useFormSuccessToast } from "@/components/toast";
import type { DropdownItem, TicketFieldDefinition } from "@itsm/db";
import { useActionState, useRef, useState } from "react";

interface FormState {
  error?: string;
}

const LEVELS = [1, 2, 3, 4, 5];

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
        urgency: Number(formData.get("urgency")),
        impact: Number(formData.get("impact")),
        priority: Number(formData.get("priority")),
        categoryDropdownItemId: (formData.get("categoryDropdownItemId") as string) || null,
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
        <label htmlFor={name} className="text-sm font-medium">{field.label}</label>
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
        <label htmlFor={name} className="text-sm font-medium">{field.label}</label>
        <textarea id={name} name={name} required={field.isRequired} className={inputClass} />
      </div>
    );
  }

  const inputType = field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text";
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium">{field.label}</label>
      <input id={name} name={name} type={inputType} required={field.isRequired} className={inputClass} />
    </div>
  );
}

export function TicketForm({
  entityId,
  fields,
  dropdownOptions,
  categoryOptions,
}: {
  entityId: string;
  fields: TicketFieldDefinition[];
  dropdownOptions: Record<string, DropdownItem[]>;
  categoryOptions: DropdownItem[];
}) {
  const [ticketType, setTicketType] = useState<"incident" | "request">("incident");
  const [state, formAction, isPending] = useActionState(makeAction(entityId, fields), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useFormSuccessToast(state, formRef, "Ticket creado.");
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";
  const visibleFields = fieldsForType(fields, ticketType);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div>
        <label htmlFor="ticket-type" className="text-sm font-medium">Tipo</label>
        <select
          id="ticket-type"
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
        <label htmlFor="ticket-title" className="text-sm font-medium">Título</label>
        <input id="ticket-title" name="title" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="ticket-content" className="text-sm font-medium">Descripción</label>
        <textarea id="ticket-content" name="content" required rows={4} className={inputClass} />
      </div>
      <div>
        <label htmlFor="ticket-category" className="text-sm font-medium">Categoría</label>
        <select id="ticket-category" name="categoryDropdownItemId" defaultValue="" className={inputClass}>
          <option value="">(ninguna)</option>
          {categoryOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="ticket-urgency" className="text-sm font-medium">Urgencia</label>
          <select id="ticket-urgency" name="urgency" defaultValue="3" required className={inputClass}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ticket-impact" className="text-sm font-medium">Impacto</label>
          <select id="ticket-impact" name="impact" defaultValue="3" required className={inputClass}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ticket-priority" className="text-sm font-medium">Prioridad</label>
          <select id="ticket-priority" name="priority" defaultValue="3" required className={inputClass}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
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
