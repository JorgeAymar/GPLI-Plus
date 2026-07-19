"use client";

import { updateAssetAction } from "@/actions/assets.actions";
import { useFormSuccessToast } from "@/components/toast";
import type { Asset } from "@itsm/db";
import { useRouter } from "next/navigation";
import { useActionState, useRef } from "react";

interface FormState {
  error?: string;
}

function makeAction(assetId: string, router: ReturnType<typeof useRouter>) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await updateAssetAction(assetId, {
        name: formData.get("name") as string,
        serialNumber: (formData.get("serialNumber") as string) || null,
        inventoryNumber: (formData.get("inventoryNumber") as string) || null,
        comment: (formData.get("comment") as string) || null,
      });
      // updateAssetAction only revalidates "/assets", not this detail route -
      // force a refetch of the server data on this page (see language-form.tsx
      // for the same pattern and rationale).
      router.refresh();
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function AssetEditForm({ asset }: { asset: Asset }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(makeAction(asset.id, router), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useFormSuccessToast(state, formRef, "Activo actualizado.");
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    // Keyed on the editable fields so that a *successful* update - which arrives
    // here as fresh `asset` props via the router.refresh() above - remounts just
    // this <form> subtree to pick up new `defaultValue`s (see the comment on
    // <AssetEditForm> in page.tsx, which deliberately does NOT key this
    // component itself). Keying the outer component instead of just the <form>
    // would tear down the useActionState/toast state in the very same commit the
    // refreshed data lands in, since both updates batch together - which
    // silently swallows the success toast before its effect ever runs (confirmed
    // empirically). Keying only the <form> element leaves the outer component's
    // hooks (and thus the toast) untouched by that remount while still
    // refreshing the visible field values.
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      key={`${asset.name}-${asset.serialNumber}-${asset.inventoryNumber}-${asset.comment}`}
    >
      <div>
        <label htmlFor="asset-edit-name" className="text-sm font-medium">Nombre</label>
        <input id="asset-edit-name" name="name" required defaultValue={asset.name} className={inputClass} />
      </div>
      <div>
        <label htmlFor="asset-edit-serial-number" className="text-sm font-medium">Número de serie</label>
        <input
          id="asset-edit-serial-number"
          name="serialNumber"
          defaultValue={asset.serialNumber ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="asset-edit-inventory-number" className="text-sm font-medium">Número de inventario</label>
        <input
          id="asset-edit-inventory-number"
          name="inventoryNumber"
          defaultValue={asset.inventoryNumber ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="asset-edit-comment" className="text-sm font-medium">Comentario</label>
        <textarea id="asset-edit-comment" name="comment" defaultValue={asset.comment ?? ""} className={inputClass} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
