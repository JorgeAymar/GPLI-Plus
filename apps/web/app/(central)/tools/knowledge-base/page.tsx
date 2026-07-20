import { requireAuthContext } from "@/lib/session";
import { listKbArticles } from "@itsm/core";
import Link from "next/link";
import { KbArticleForm } from "./kb-article-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Base de conocimiento" };

export default async function KnowledgeBasePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const context = await requireAuthContext();
  const articles = await listKbArticles(context, { search: q });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Base de conocimiento</h1>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por título o contenido..."
          className="w-full max-w-md rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
        <button type="submit" className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          Buscar
        </button>
      </form>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Artículos</h2>
          <ul className="space-y-1">
            {articles.map((a) => (
              <li key={a.id}>
                <Link href={`/tools/knowledge-base/${a.id}`} className="text-sm hover:underline">
                  {a.isPinned ? "\u{1F4CC} " : ""}
                  {a.title}
                  {a.isFaq ? <span className="opacity-40"> (FAQ)</span> : null}
                </Link>
              </li>
            ))}
            {articles.length === 0 ? <li className="text-sm opacity-50">Sin artículos todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-60">Nuevo artículo</h2>
          <KbArticleForm entityId={context.activeEntity.id} authorUserId={context.user.id} />
        </div>
      </div>
    </div>
  );
}
