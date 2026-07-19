"use client";

import { createAssetFieldDefinitionAction } from "@/actions/asset-definitions.actions";
import type { DropdownCategory } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

const FIELD_TYPES = ["text", "textarea", "number", "boolean", "date", "dropdown"] as const;

function makeAction(assetDefinitionId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const fieldType = formData.get("fieldType") as (typeof FIELD_TYPES)[number];
      await createAssetFieldDefinitionAction({
        assetDefinitionId,
        key: formData.get("key") as string,
        label: formData.get("label") as string,
        fieldType,
        dropdownCategoryId: fieldType === "dropdown" ? (formData.get("dropdownCategoryId") as string) || null : null,
        isRequired: formData.get("isRequired") === "on",
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function FieldDefinitionForm({ assetDefinitionId, dropdownCategories }: { assetDefinitionId: string; dropdownCategories: DropdownCategory[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(assetDefinitionId), undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="field-definition-key" className="text-sm font-medium">Clave (key)</label>
        <input
          id="field-definition-key"
          name="key"
          required
          placeholder="screen_size"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="field-definition-label" className="text-sm font-medium">Etiqueta</label>
        <input
          id="field-definition-label"
          name="label"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <div>
        <label htmlFor="field-definition-type" className="text-sm font-medium">Tipo de dato</label>
        <select
          id="field-definition-type"
          name="fieldType"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="field-definition-dropdown-category" className="text-sm font-medium">Categoría de lista (solo si tipo = dropdown)</label>
        <select
          id="field-definition-dropdown-category"
          name="dropdownCategoryId"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          <option value="">(ninguna)</option>
          {dropdownCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
