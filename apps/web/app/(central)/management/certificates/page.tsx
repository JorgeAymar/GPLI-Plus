import { requireAuthContext } from "@/lib/session";
import { listAssets, listCertificates } from "@itsm/core";
import { CertificateForm } from "./certificate-form";

const CERTIFICATE_TYPE_LABEL: Record<string, string> = {
  ssl: "SSL",
  code_signing: "Firma de código",
  other: "Otro",
};

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Certificados" };

export default async function CertificatesPage() {
  const context = await requireAuthContext();
  const [certificates, assets] = await Promise.all([
    listCertificates(context.activeEntity.id, { includeSubtree: true }),
    listAssets(context.activeEntity.id, { includeSubtree: true }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Certificados</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {certificates.map((c) => (
              <li key={c.id} className="text-sm">
                {c.name} <span className="opacity-40">({CERTIFICATE_TYPE_LABEL[c.certificateType] ?? c.certificateType})</span>
                {c.validUntil ? (
                  <span className="opacity-40"> · vence {new Date(c.validUntil).toLocaleDateString()}</span>
                ) : null}
              </li>
            ))}
            {certificates.length === 0 ? <li className="text-sm opacity-50">Sin certificados todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo certificado</h2>
          <CertificateForm entityId={context.activeEntity.id} assets={assets.map((a) => ({ id: a.id, name: a.name }))} />
        </div>
      </div>
    </div>
  );
}
