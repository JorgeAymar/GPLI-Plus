import { requireAuthContext } from "@/lib/session";
import { AttachmentsSection } from "@/components/documents/attachments-section";
import {
  getComputerWithAsset,
  listAssetComponents,
  listInstallationsForAsset,
  listSoftware,
  listSoftwareVersions,
} from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetEditForm } from "./asset-edit-form";
import { ComponentForm } from "./component-form";
import { InstallSoftwareForm } from "./install-software-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await getComputerWithAsset(id);
  return { title: result?.asset.name ?? "Computadora" };
}

export default async function ComputerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAuthContext();

  const result = await getComputerWithAsset(id);
  if (!result) notFound();
  const { asset, computer } = result;

  const [components, installations, softwareList] = await Promise.all([
    listAssetComponents(asset.id),
    listInstallationsForAsset(asset.id),
    listSoftware(context.activeEntity.id, { includeSubtree: true }),
  ]);

  // Flatten software -> versions into a single {id, label} list for the
  // install-software select, and a lookup map to label existing installations.
  const versionLabels = new Map<string, string>();
  const versionOptions: { id: string; label: string }[] = [];
  for (const item of softwareList) {
    const versions = await listSoftwareVersions(item.id);
    for (const v of versions) {
      const label = `${item.name} ${v.name}`;
      versionLabels.set(v.id, label);
      versionOptions.push({ id: v.id, label });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{asset.name}</h1>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Editar activo</h2>
        {/* No key derived from the editable fields here on purpose - the field-based
            remount key that picks up fresh defaultValues after a save lives on the
            <form> INSIDE AssetEditForm, not on this component instance. Keying this
            outer instance by the mutable fields would remount it (and its
            useActionState/toast state) in the very same commit the post-save
            router.refresh() delivers fresh data in, silently losing the success
            toast - see the comment in asset-edit-form.tsx. */}
        <AssetEditForm asset={asset} />
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <dt className="opacity-60">Dominio</dt>
          <dd>{computer.domain ?? "-"}</dd>
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Componentes</h2>
          <ul className="space-y-1">
            {components.map((c) => (
              <li key={c.id} className="text-sm">
                {c.name}{" "}
                <span className="opacity-40">
                  ({c.componentType}
                  {c.capacityValue ? `, ${c.capacityValue}${c.capacityUnit ?? ""}` : ""}
                  {c.quantity > 1 ? ` x${c.quantity}` : ""})
                </span>
              </li>
            ))}
            {components.length === 0 ? <li className="text-sm opacity-50">Sin componentes todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo componente</h2>
          <ComponentForm assetId={asset.id} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Software instalado</h2>
        <ul className="mb-3 space-y-1">
          {installations.map((i) => (
            <li key={i.id} className="text-sm">
              {versionLabels.get(i.softwareVersionId) ?? i.softwareVersionId}
            </li>
          ))}
          {installations.length === 0 ? <li className="text-sm opacity-50">Sin software instalado todavía.</li> : null}
        </ul>
        <InstallSoftwareForm assetId={asset.id} versionOptions={versionOptions} />
      </div>

      <AttachmentsSection itemType="computer" itemId={asset.id} revalidatePathTarget={`/assets/computers/${asset.id}`} />
    </div>
  );
}
