"use client";

import { uploadDocumentAction } from "@/actions/documents.actions";
import { useActionState, useRef } from "react";

interface FormState {
  error?: string;
}

function makeAction(itemType: string, itemId: string, revalidatePathTarget: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    formData.set("itemType", itemType);
    formData.set("itemId", itemId);
    try {
      await uploadDocumentAction(formData, revalidatePathTarget);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function UploadDocumentForm({
  itemType,
  itemId,
  revalidatePathTarget,
}: {
  itemType: string;
  itemId: string;
  revalidatePathTarget: string;
}) {
  const [state, formAction, isPending] = useActionState(makeAction(itemType, itemId, revalidatePathTarget), undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex items-center gap-2"
    >
      <input type="file" name="file" required className="text-sm" />
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/15 disabled:opacity-50"
      >
        {isPending ? "Subiendo..." : "Subir"}
      </button>
    </form>
  );
}
