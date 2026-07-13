"use client";

import { createCableAction } from "@/actions/dcim.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

interface AssetOption {
  id: string;
  name: string;
}

interface DropdownOption {
  id: string;
  name: string;
}

function makeAction() {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      const cableTypeDropdownItemId = formData.get("cableTypeDropdownItemId") as string;
      await createCableAction({
        name: (formData.get("name") as string) || null,
        endpointAAssetId: formData.get("endpointAAssetId") as string,
        endpointBAssetId: formData.get("endpointBAssetId") as string,
        cableTypeDropdownItemId: cableTypeDropdownItemId || null,
        comment: (formData.get("comment") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function CableForm({ assets, cableTypes }: { assets: AssetOption[]; cableTypes: DropdownOption[] }) {
  const [state, formAction, isPending] = useActionState(makeAction(), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Nombre</label>
        <input name="name" className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium">Extremo A</label>
        <select name="endpointAAssetId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Selecciona un activo...
          </option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Extremo B</label>
        <select name="endpointBAssetId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Selecciona un activo...
          </option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      {cableTypes.length > 0 ? (
        <div>
          <label className="text-sm font-medium">Tipo de cable</label>
          <select name="cableTypeDropdownItemId" defaultValue="" className={inputClass}>
            <option value="">Ninguno</option>
            {cableTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label className="text-sm font-medium">Comentario</label>
        <textarea name="comment" className={inputClass} rows={2} />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear cable"}
      </button>
    </form>
  );
}
