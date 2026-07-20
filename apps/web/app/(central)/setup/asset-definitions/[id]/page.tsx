import { getAssetDefinition, listAssetFieldDefinitions, listDropdownCategories } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FieldDefinitionForm } from "./field-definition-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const definition = await getAssetDefinition(id);
  return { title: definition?.name ?? "Tipo de activo" };
}

export default async function AssetDefinitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const definition = await getAssetDefinition(id);
  if (!definition) notFound();

  const [fields, dropdownCategories] = await Promise.all([listAssetFieldDefinitions(id), listDropdownCategories()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{definition.name}</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Campos personalizados</h2>
          <ul className="space-y-1">
            {fields.map((f) => (
              <li key={f.id} className="text-sm">
                {f.label} <span className="opacity-40">({f.fieldType}{f.isRequired ? ", requerido" : ""})</span>
              </li>
            ))}
            {fields.length === 0 ? <li className="text-sm opacity-50">Sin campos todavía.</li> : null}
          </ul>
        </div>
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Nuevo campo</h2>
          <FieldDefinitionForm assetDefinitionId={id} dropdownCategories={dropdownCategories} />
        </div>
      </div>
    </div>
  );
}
