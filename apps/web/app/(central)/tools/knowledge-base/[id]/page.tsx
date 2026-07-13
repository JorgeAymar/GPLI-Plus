import { revertKbArticleAction } from "@/actions/knowledge-base.actions";
import { requireAuthContext } from "@/lib/session";
import { getKbArticle, incrementKbArticleViewCount, listKbArticleRevisions, listKbComments, listUsers } from "@itsm/core";
import { notFound } from "next/navigation";
import { KbCommentForm } from "./kb-comment-form";
import { RevertButton } from "./revert-button";

export default async function KbArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuthContext();

  const article = await getKbArticle(id);
  if (!article) notFound();

  await incrementKbArticleViewCount(id);

  const [comments, revisions, users] = await Promise.all([listKbComments(id), listKbArticleRevisions(id), listUsers()]);
  const userNameById = new Map(users.map((u) => [u.id, u.displayName]));

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          {article.isPinned ? <span title="Fijado">{"\u{1F4CC}"}</span> : null}
          <h1 className="text-2xl font-semibold">{article.title}</h1>
          {article.isFaq ? <span className="rounded-md border border-black/15 px-2 py-0.5 text-xs dark:border-white/15">FAQ</span> : null}
        </div>
        <p className="mt-1 text-xs opacity-50">
          {/* article was fetched before incrementKbArticleViewCount() above, so +1 reflects this view without a re-fetch */}
          Por {userNameById.get(article.authorUserId) ?? article.authorUserId} · {article.viewCount + 1} vistas
        </p>
      </div>

      <pre className="whitespace-pre-wrap text-sm opacity-80">{article.body}</pre>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Comentarios</h2>
        <ul className="mb-3 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-md border border-black/10 p-2 text-sm dark:border-white/10">
              <div className="mb-1 text-xs opacity-50">
                {userNameById.get(c.authorUserId) ?? c.authorUserId} · {new Date(c.createdAt).toLocaleString()}
                {c.parentCommentId ? " · respuesta" : null}
              </div>
              <p className="whitespace-pre-wrap">{c.content}</p>
            </li>
          ))}
          {comments.length === 0 ? <li className="text-sm opacity-50">Sin comentarios todavía.</li> : null}
        </ul>
        <KbCommentForm articleId={id} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Historial de revisiones</h2>
        <ul className="space-y-2">
          {revisions.map((r, index) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-md border border-black/10 p-2 text-sm dark:border-white/10"
            >
              <div>
                <span className="opacity-70">{r.action}</span>{" "}
                <span className="opacity-50">
                  · {userNameById.get(r.actorUserId ?? "") ?? r.actorUserId ?? "sistema"} · {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              {index === 0 ? (
                <span className="text-xs opacity-40">versión actual</span>
              ) : (
                <RevertButton articleId={id} auditLogId={r.id} revertAction={revertKbArticleAction} />
              )}
            </li>
          ))}
          {revisions.length === 0 ? <li className="text-sm opacity-50">Sin historial todavía.</li> : null}
        </ul>
      </div>
    </div>
  );
}
