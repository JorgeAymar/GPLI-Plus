import { softDeleteAssetAction } from "@/actions/assets.actions";
import { requireAuthContext } from "@/lib/session";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { getAssetDefinitionByKey, listAssetFieldDefinitions, listAssets, listDropdownItems } from "@itsm/core";
import type { DropdownItem } from "@itsm/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GenericAssetForm } from "./generic-asset-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ assetType: string }>;
}): Promise<Metadata> {
  const { assetType } = await params;
  const definition = await getAssetDefinitionByKey(assetType);
  return { title: definition?.name ?? "Activos" };
}

export default async function AssetTypePage({ params }: { params: Promise<{ assetType: string }> }) {
  const { assetType } = await params;
  const context = await requireAuthContext();

  const definition = await getAssetDefinitionByKey(assetType);
  if (!definition) notFound();

  const [assets, fields] = await Promise.all([
    listAssets(context.activeEntity.id, { assetDefinitionId: definition.id, includeSubtree: true }),
    listAssetFieldDefinitions(definition.id),
  ]);

  const dropdownOptions: Record<string, DropdownItem[]> = {};
  for (const field of fields) {
    if (field.fieldType === "dropdown" && field.dropdownCategoryId) {
      dropdownOptions[field.key] = await listDropdownItems(field.dropdownCategoryId, context.activeEntity.id);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{definition.name}</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Instancias existentes</h2>
          <ul className="space-y-1">
            {assets.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/assets/${assetType}/${a.id}`} className="hover:underline">
                  {a.name} {a.serialNumber ? <span className="opacity-40">({a.serialNumber})</span> : null}
                </Link>
                <ConfirmDeleteButton
                  id={a.id}
                  action={softDeleteAssetAction}
                  confirmMessage={`¿Eliminar "${a.name}"? Esta acción no se puede deshacer.`}
                />
              </li>
            ))}
            {assets.length === 0 ? <li className="text-sm opacity-50">Sin instancias todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo {definition.name.toLowerCase()}</h2>
          <GenericAssetForm
            assetDefinitionId={definition.id}
            entityId={context.activeEntity.id}
            fields={fields}
            dropdownOptions={dropdownOptions}
          />
        </div>
      </div>
    </div>
  );
}
