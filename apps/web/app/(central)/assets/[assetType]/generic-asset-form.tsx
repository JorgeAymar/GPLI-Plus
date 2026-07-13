"use client";

import { createAssetAction } from "@/actions/assets.actions";
import type { AssetFieldDefinition, DropdownItem } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function buildCustomFields(formData: FormData, fields: AssetFieldDefinition[]): Record<string, unknown> {
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

function makeAction(assetDefinitionId: string, entityId: string, fields: AssetFieldDefinition[]) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createAssetAction({
        entityId,
        assetDefinitionId,
        name: formData.get("name") as string,
        serialNumber: (formData.get("serialNumber") as string) || null,
        inventoryNumber: (formData.get("inventoryNumber") as string) || null,
        comment: (formData.get("comment") as string) || null,
        customFields: buildCustomFields(formData, fields),
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

function DynamicField({ field, options }: { field: AssetFieldDefinition; options: DropdownItem[] }) {
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

export function GenericAssetForm({
  assetDefinitionId,
  entityId,
  fields,
  dropdownOptions,
}: {
  assetDefinitionId: string;
  entityId: string;
  fields: AssetFieldDefinition[];
  dropdownOptions: Record<string, DropdownItem[]>;
}) {
  const [state, formAction, isPending] = useActionState(makeAction(assetDefinitionId, entityId, fields), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="asset-name" className="text-sm font-medium">Nombre</label>
        <input id="asset-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="asset-serial-number" className="text-sm font-medium">Número de serie</label>
        <input id="asset-serial-number" name="serialNumber" className={inputClass} />
      </div>
      <div>
        <label htmlFor="asset-inventory-number" className="text-sm font-medium">Número de inventario</label>
        <input id="asset-inventory-number" name="inventoryNumber" className={inputClass} />
      </div>
      {fields.map((field) => (
        <DynamicField key={field.id} field={field} options={dropdownOptions[field.key] ?? []} />
      ))}
      <div>
        <label htmlFor="asset-comment" className="text-sm font-medium">Comentario</label>
        <textarea id="asset-comment" name="comment" className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear"}
      </button>
    </form>
  );
}
