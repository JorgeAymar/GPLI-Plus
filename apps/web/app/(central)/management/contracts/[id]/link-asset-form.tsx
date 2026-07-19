"use client";

import { linkContractAssetAction } from "@/actions/contracts.actions";
import type { Asset } from "@itsm/db";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(contractId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await linkContractAssetAction({ contractId, assetId: formData.get("assetId") as string });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function LinkAssetForm({ contractId, assets }: { contractId: string; assets: Asset[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(contractId), undefined);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="link-asset-asset-id" className="text-sm font-medium">Activo</label>
        <select
          id="link-asset-asset-id"
          name="assetId"
          required
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending || assets.length === 0}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "..." : "Vincular"}
      </button>
    </form>
  );
}
