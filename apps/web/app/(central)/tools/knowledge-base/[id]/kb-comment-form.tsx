"use client";

import { addKbCommentAction } from "@/actions/knowledge-base.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

function makeAction(articleId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await addKbCommentAction({
        articleId,
        content: formData.get("content") as string,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function KbCommentForm({ articleId }: { articleId: string }) {
  const [state, formAction, isPending] = useActionState(makeAction(articleId), undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-2">
      <textarea name="content" required placeholder="Escribe un comentario..." rows={3} className={inputClass} />
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Enviando..." : "Comentar"}
      </button>
    </form>
  );
}
