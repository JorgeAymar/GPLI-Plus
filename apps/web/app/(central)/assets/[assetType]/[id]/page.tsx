import { requireAuthContext } from "@/lib/session";
import { AttachmentsSection } from "@/components/documents/attachments-section";
import { getAsset, getAssetDefinitionByKey, listAssetFieldDefinitions, listDropdownItems } from "@itsm/core";
import type { DropdownItem } from "@itsm/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GenericAssetEditForm } from "./generic-asset-edit-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ assetType: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const asset = await getAsset(id);
  return { title: asset?.name ?? "Activo" };
}

export default async function GenericAssetDetailPage({
  params,
}: {
  params: Promise<{ assetType: string; id: string }>;
}) {
  const { assetType, id } = await params;
  const context = await requireAuthContext();

  const definition = await getAssetDefinitionByKey(assetType);
  if (!definition) notFound();

  const asset = await getAsset(id);
  // Guard against a mismatched URL (e.g. /assets/monitor/<id-of-a-printer>) rather than
  // silently rendering a printer under a "monitor" heading.
  if (!asset || asset.assetDefinitionId !== definition.id) notFound();

  const fields = await listAssetFieldDefinitions(definition.id);

  const dropdownOptions: Record<string, DropdownItem[]> = {};
  for (const field of fields) {
    if (field.fieldType === "dropdown" && field.dropdownCategoryId) {
      dropdownOptions[field.key] = await listDropdownItems(field.dropdownCategoryId, context.activeEntity.id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{asset.name}</h1>
        <span className="text-sm opacity-60">{definition.name}</span>
      </div>

      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Editar activo</h2>
        <GenericAssetEditForm asset={asset} fields={fields} dropdownOptions={dropdownOptions} />
      </div>

      <AttachmentsSection itemType="asset" itemId={asset.id} revalidatePathTarget={`/assets/${assetType}/${asset.id}`} />
    </div>
  );
}
