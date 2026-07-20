import { requireAuthContext } from "@/lib/session";
import { countSeatsUsed, getSoftware, listSoftwareLicenses, listSoftwareVersions } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SoftwareLicenseForm } from "./software-license-form";
import { SoftwareVersionForm } from "./software-version-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const softwareItem = await getSoftware(id);
  return { title: softwareItem?.name ?? "Software" };
}

export default async function SoftwareDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAuthContext();

  const softwareItem = await getSoftware(id);
  if (!softwareItem) notFound();

  const [versions, licenses] = await Promise.all([listSoftwareVersions(id), listSoftwareLicenses(id)]);
  const seatsUsedByLicense = new Map<string, number>();
  for (const license of licenses) {
    seatsUsedByLicense.set(license.id, await countSeatsUsed(license.id));
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{softwareItem.name}</h1>

      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Versiones</h2>
        <ul className="mb-3 space-y-1">
          {versions.map((v) => (
            <li key={v.id} className="text-sm">
              {v.name}
            </li>
          ))}
          {versions.length === 0 ? <li className="text-sm opacity-50">Sin versiones todavía.</li> : null}
        </ul>
        <SoftwareVersionForm softwareId={id} />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Licencias</h2>
          <ul className="space-y-1">
            {licenses.map((l) => (
              <li key={l.id} className="text-sm">
                {l.name} <span className="opacity-40">({l.licenseType})</span> —{" "}
                {seatsUsedByLicense.get(l.id) ?? 0}/{l.seatsTotal ?? "∞"} asientos
              </li>
            ))}
            {licenses.length === 0 ? <li className="text-sm opacity-50">Sin licencias todavía.</li> : null}
          </ul>
        </div>
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Nueva licencia</h2>
          <SoftwareLicenseForm entityId={context.activeEntity.id} softwareId={id} versions={versions} />
        </div>
      </div>
    </div>
  );
}
