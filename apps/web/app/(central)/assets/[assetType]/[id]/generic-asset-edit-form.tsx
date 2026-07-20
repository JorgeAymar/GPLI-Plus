"use client";

import { updateAssetAction } from "@/actions/assets.actions";
import { useFormSuccessToast } from "@/components/toast";
import type { Asset, AssetFieldDefinition, DropdownItem } from "@itsm/db";
import { useRouter } from "next/navigation";
import { useActionState, useRef } from "react";

interface FormState {
  error?: string;
}

// Mirrors ../generic-asset-form.tsx's buildCustomFields exactly (create-mode) - same
// dynamic-field-to-customFields mapping, just fed by updateAssetAction instead of
// createAssetAction. See that file for the rationale on the isRequired branch.
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

function makeAction(assetId: string, fields: AssetFieldDefinition[], router: ReturnType<typeof useRouter>) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await updateAssetAction(assetId, {
        name: formData.get("name") as string,
        serialNumber: (formData.get("serialNumber") as string) || null,
        inventoryNumber: (formData.get("inventoryNumber") as string) || null,
        comment: (formData.get("comment") as string) || null,
        customFields: buildCustomFields(formData, fields),
      });
      // updateAssetAction only revalidates "/assets", not this detail route - force a
      // refetch of the server data on this page (same pattern as computers/[id]/asset-edit-form.tsx).
      router.refresh();
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

function stringDefault(field: AssetFieldDefinition, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (field.fieldType === "date") {
    // customFields stores dates as JSON (ISO datetime strings), but <input type="date">
    // requires exactly YYYY-MM-DD.
    return String(value).slice(0, 10);
  }
  return String(value);
}

function DynamicEditField({
  field,
  options,
  value,
}: {
  field: AssetFieldDefinition;
  options: DropdownItem[];
  value: unknown;
}) {
  const name = `field_${field.key}`;
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  if (field.fieldType === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={name} required={field.isRequired} defaultChecked={value === true} />
        {field.label}
      </label>
    );
  }

  if (field.fieldType === "dropdown") {
    return (
      <div>
        <label htmlFor={name} className="text-sm font-medium">{field.label}</label>
        <select id={name} name={name} required={field.isRequired} defaultValue={stringDefault(field, value)} className={inputClass}>
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
        <textarea id={name} name={name} required={field.isRequired} defaultValue={stringDefault(field, value)} className={inputClass} />
      </div>
    );
  }

  const inputType = field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text";
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium">{field.label}</label>
      <input
        id={name}
        name={name}
        type={inputType}
        required={field.isRequired}
        defaultValue={stringDefault(field, value)}
        className={inputClass}
      />
    </div>
  );
}

export function GenericAssetEditForm({
  asset,
  fields,
  dropdownOptions,
}: {
  asset: Asset;
  fields: AssetFieldDefinition[];
  dropdownOptions: Record<string, DropdownItem[]>;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(makeAction(asset.id, fields, router), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useFormSuccessToast(state, formRef, "Activo actualizado.");
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";
  const customFields = (asset.customFields ?? {}) as Record<string, unknown>;

  return (
    // Keyed on the editable fields (base + custom) for the same reason as
    // computers/[id]/asset-edit-form.tsx: a successful update arrives here as fresh
    // `asset` props via the router.refresh() above, and this key remounts just the
    // <form> subtree to pick up new defaultValues without tearing down the outer
    // component's useActionState/toast state (which would silently swallow the toast).
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      key={`${asset.name}-${asset.serialNumber}-${asset.inventoryNumber}-${asset.comment}-${JSON.stringify(customFields)}`}
    >
      <div>
        <label htmlFor="asset-edit-name" className="text-sm font-medium">Nombre</label>
        <input id="asset-edit-name" name="name" required defaultValue={asset.name} className={inputClass} />
      </div>
      <div>
        <label htmlFor="asset-edit-serial-number" className="text-sm font-medium">Número de serie</label>
        <input
          id="asset-edit-serial-number"
          name="serialNumber"
          defaultValue={asset.serialNumber ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="asset-edit-inventory-number" className="text-sm font-medium">Número de inventario</label>
        <input
          id="asset-edit-inventory-number"
          name="inventoryNumber"
          defaultValue={asset.inventoryNumber ?? ""}
          className={inputClass}
        />
      </div>
      {fields.map((field) => (
        <DynamicEditField key={field.id} field={field} options={dropdownOptions[field.key] ?? []} value={customFields[field.key]} />
      ))}
      <div>
        <label htmlFor="asset-edit-comment" className="text-sm font-medium">Comentario</label>
        <textarea id="asset-edit-comment" name="comment" defaultValue={asset.comment ?? ""} className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
