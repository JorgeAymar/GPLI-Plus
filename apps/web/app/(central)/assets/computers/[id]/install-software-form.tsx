"use client";

import { createInstallationAction } from "@/actions/software.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

interface VersionOption {
  id: string;
  label: string;
}

interface LicenseOption {
  id: string;
  label: string;
}

function makeAction(assetId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const softwareLicenseId = formData.get("softwareLicenseId") as string;
      await createInstallationAction({
        assetId,
        softwareVersionId: formData.get("softwareVersionId") as string,
        softwareLicenseId: softwareLicenseId || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function InstallSoftwareForm({
  assetId,
  versionOptions,
  licenseOptions,
}: {
  assetId: string;
  versionOptions: VersionOption[];
  licenseOptions: LicenseOption[];
}) {
  const [state, formAction, isPending] = useActionState(makeAction(assetId), undefined);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="install-software-version" className="text-sm font-medium">Software a instalar</label>
        <select
          id="install-software-version"
          name="softwareVersionId"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          {versionOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        {/* Optional: counts against the license's seat total (see countSeatsUsed) - left
            unselected when a computer is running unlicensed/unmanaged software. */}
        <label htmlFor="install-software-license" className="text-sm font-medium">Licencia (opcional)</label>
        <select
          id="install-software-license"
          name="softwareLicenseId"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          <option value="">Sin licencia</option>
          {licenseOptions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending || versionOptions.length === 0}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Instalando..." : "Instalar"}
      </button>
    </form>
  );
}
