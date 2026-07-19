"use client";

import { createCertificateAction } from "@/actions/certificates.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

interface AssetOption {
  id: string;
  name: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const assignedAssetId = formData.get("assignedAssetId") as string;
      await createCertificateAction({
        entityId,
        name: formData.get("name") as string,
        certificateType: formData.get("certificateType") as string,
        issuer: (formData.get("issuer") as string) || null,
        serialNumber: (formData.get("serialNumber") as string) || null,
        validFrom: (formData.get("validFrom") as string) || null,
        validUntil: (formData.get("validUntil") as string) || null,
        assignedAssetId: assignedAssetId || null,
        comment: (formData.get("comment") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function CertificateForm({ entityId, assets }: { entityId: string; assets: AssetOption[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="certificate-name" className="text-sm font-medium">Nombre</label>
        <input id="certificate-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="certificate-type" className="text-sm font-medium">Tipo</label>
        <select id="certificate-type" name="certificateType" defaultValue="ssl" className={inputClass}>
          <option value="ssl">SSL</option>
          <option value="code_signing">Firma de código</option>
          <option value="other">Otro</option>
        </select>
      </div>
      <div>
        <label htmlFor="certificate-issuer" className="text-sm font-medium">Emisor</label>
        <input id="certificate-issuer" name="issuer" className={inputClass} />
      </div>
      <div>
        <label htmlFor="certificate-serial-number" className="text-sm font-medium">Número de serie</label>
        <input id="certificate-serial-number" name="serialNumber" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="certificate-valid-from" className="text-sm font-medium">Válido desde</label>
          <input id="certificate-valid-from" name="validFrom" type="date" className={inputClass} />
        </div>
        <div>
          <label htmlFor="certificate-valid-until" className="text-sm font-medium">Válido hasta</label>
          <input id="certificate-valid-until" name="validUntil" type="date" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="certificate-assigned-asset" className="text-sm font-medium">Activo asignado</label>
        <select id="certificate-assigned-asset" name="assignedAssetId" defaultValue="" className={inputClass}>
          <option value="">Ninguno</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="certificate-comment" className="text-sm font-medium">Comentario</label>
        <textarea id="certificate-comment" name="comment" className={inputClass} rows={2} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear certificado"}
      </button>
    </form>
  );
}
