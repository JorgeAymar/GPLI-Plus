import {
  auditLog,
  db,
  kbArticleCategories,
  kbArticleComments,
  kbArticles,
  kbCategories,
  type AuditLogEntry,
  type KbArticle,
  type KbArticleComment,
  type KbCategory,
} from "@itsm/db";
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { recordAuditLog } from "../audit/audit-service";
import type { AuthContext } from "../auth/get-auth-context";
import { listSubtree } from "../entities/entity-service";
import { isResourceVisibleTo } from "../visibility/visibility-service";

export async function createKbCategory(input: { parentId?: string | null; name: string; comment?: string | null }): Promise<KbCategory> {
  const [created] = await db
    .insert(kbCategories)
    .values({
      parentId: input.parentId ?? null,
      name: input.name,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert KB category");
  return created;
}

export async function listKbCategories(): Promise<KbCategory[]> {
  return db.select().from(kbCategories).orderBy(kbCategories.name);
}

export async function createKbArticle(
  input: {
    entityId: string;
    title: string;
    body: string;
    isFaq?: boolean;
    isPinned?: boolean;
    authorUserId: string;
    showInServiceCatalog?: boolean;
    beginDate?: string | Date | null;
    endDate?: string | Date | null;
  },
  actorUserId: string,
): Promise<KbArticle> {
  const [created] = await db
    .insert(kbArticles)
    .values({
      entityId: input.entityId,
      title: input.title,
      body: input.body,
      isFaq: input.isFaq ?? false,
      isPinned: input.isPinned ?? false,
      authorUserId: input.authorUserId,
      showInServiceCatalog: input.showInServiceCatalog ?? false,
      beginDate: input.beginDate ? new Date(input.beginDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert KB article");

  await recordAuditLog({
    entityId: created.entityId,
    actorUserId,
    action: "create",
    objectType: "kb_article",
    objectId: created.id,
    after: created,
  });

  return created;
}

/**
 * No dedicated kb_article_revisions table (design decision): every update
 * writes a full before/after pair to the generic audit_log, which is what
 * listKbArticleRevisions/revertKbArticle below read back. That means every
 * caller MUST go through this function for article field changes - direct
 * `db.update(kbArticles)` calls elsewhere would silently break history.
 */
export async function updateKbArticle(
  id: string,
  input: Partial<{
    title: string;
    body: string;
    isFaq: boolean;
    isPinned: boolean;
    authorUserId: string;
    showInServiceCatalog: boolean;
    beginDate: string | Date | null;
    endDate: string | Date | null;
  }>,
  actorUserId: string,
): Promise<KbArticle> {
  const before = await getKbArticle(id);
  if (!before) throw new Error(`KB article ${id} not found`);

  const [updated] = await db
    .update(kbArticles)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.isFaq !== undefined ? { isFaq: input.isFaq } : {}),
      ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      ...(input.authorUserId !== undefined ? { authorUserId: input.authorUserId } : {}),
      ...(input.showInServiceCatalog !== undefined ? { showInServiceCatalog: input.showInServiceCatalog } : {}),
      ...(input.beginDate !== undefined ? { beginDate: input.beginDate ? new Date(input.beginDate) : null } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(kbArticles.id, id))
    .returning();
  if (!updated) throw new Error(`Failed to update KB article ${id}`);

  await recordAuditLog({
    entityId: updated.entityId,
    actorUserId,
    action: "update",
    objectType: "kb_article",
    objectId: id,
    before,
    after: updated,
  });

  return updated;
}

export async function getKbArticle(id: string): Promise<KbArticle | undefined> {
  const [article] = await db.select().from(kbArticles).where(eq(kbArticles.id, id));
  return article;
}

/**
 * Candidates are scoped by entity subtree + soft-delete + effective date range
 * + optional FAQ/search filters at the SQL level, then narrowed down to only
 * the ones the caller can actually see via isResourceVisibleTo (per-row check,
 * reusing the shared visibility-service instead of a bespoke permission join).
 */
export async function listKbArticles(context: AuthContext, options?: { search?: string; onlyFaq?: boolean }): Promise<KbArticle[]> {
  const entityIds = (await listSubtree(context.activeEntity.id)).map((e) => e.id);
  const now = new Date();

  const conditions = [
    inArray(kbArticles.entityId, entityIds),
    isNull(kbArticles.deletedAt),
    or(isNull(kbArticles.beginDate), lte(kbArticles.beginDate, now)),
    or(isNull(kbArticles.endDate), gte(kbArticles.endDate, now)),
  ];

  if (options?.onlyFaq) {
    conditions.push(eq(kbArticles.isFaq, true));
  }
  if (options?.search) {
    const term = `%${options.search}%`;
    conditions.push(or(ilike(kbArticles.title, term), ilike(kbArticles.body, term)));
  }

  const candidates = await db
    .select()
    .from(kbArticles)
    .where(and(...conditions))
    .orderBy(desc(kbArticles.isPinned), desc(kbArticles.createdAt));

  const visible: KbArticle[] = [];
  for (const article of candidates) {
    if (await isResourceVisibleTo("kb_article", article.id, article.authorUserId, context)) {
      visible.push(article);
    }
  }
  return visible;
}

export async function addKbArticleCategory(articleId: string, categoryId: string): Promise<void> {
  await db.insert(kbArticleCategories).values({ articleId, categoryId }).onConflictDoNothing();
}

export async function removeKbArticleCategory(articleId: string, categoryId: string): Promise<void> {
  await db
    .delete(kbArticleCategories)
    .where(and(eq(kbArticleCategories.articleId, articleId), eq(kbArticleCategories.categoryId, categoryId)));
}

export async function listKbArticleCategories(articleId: string): Promise<KbCategory[]> {
  const rows = await db
    .select({ category: kbCategories })
    .from(kbArticleCategories)
    .innerJoin(kbCategories, eq(kbCategories.id, kbArticleCategories.categoryId))
    .where(eq(kbArticleCategories.articleId, articleId));
  return rows.map((r) => r.category);
}

export async function addKbComment(input: {
  articleId: string;
  parentCommentId?: string | null;
  authorUserId: string;
  content: string;
}): Promise<KbArticleComment> {
  const [created] = await db
    .insert(kbArticleComments)
    .values({
      articleId: input.articleId,
      parentCommentId: input.parentCommentId ?? null,
      authorUserId: input.authorUserId,
      content: input.content,
    })
    .returning();
  if (!created) throw new Error("Failed to insert KB article comment");
  return created;
}

/** Flat list ordered by createdAt - the UI nests replies under parentCommentId itself. */
export async function listKbComments(articleId: string): Promise<KbArticleComment[]> {
  return db.select().from(kbArticleComments).where(eq(kbArticleComments.articleId, articleId)).orderBy(kbArticleComments.createdAt);
}

/** Revision history = audit_log rows for this object, newest first (no separate revisions table - see updateKbArticle). */
export async function listKbArticleRevisions(articleId: string): Promise<AuditLogEntry[]> {
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.objectType, "kb_article"), eq(auditLog.objectId, articleId)))
    .orderBy(desc(auditLog.createdAt));
}

/**
 * Reverts by replaying the targeted audit_log row's `before` snapshot through
 * updateKbArticle - which itself writes a brand-new audit_log entry, exactly
 * like GLPI's revision revert (a revert is just another update, never a
 * destructive rewrite of history).
 */
export async function revertKbArticle(articleId: string, auditLogId: string, actorUserId: string): Promise<KbArticle> {
  const [entry] = await db.select().from(auditLog).where(eq(auditLog.id, auditLogId));
  if (!entry) throw new Error(`Audit log entry ${auditLogId} not found`);
  if (entry.objectType !== "kb_article" || entry.objectId !== articleId) {
    throw new Error(`Audit log entry ${auditLogId} does not belong to KB article ${articleId}`);
  }

  const before = entry.before as Partial<KbArticle> | null;
  if (!before) throw new Error(`Audit log entry ${auditLogId} has no "before" snapshot to revert to`);

  return updateKbArticle(
    articleId,
    {
      title: before.title,
      body: before.body,
      isFaq: before.isFaq,
      isPinned: before.isPinned,
      authorUserId: before.authorUserId,
      showInServiceCatalog: before.showInServiceCatalog,
      beginDate: before.beginDate ?? null,
      endDate: before.endDate ?? null,
    },
    actorUserId,
  );
}

export async function incrementKbArticleViewCount(id: string): Promise<void> {
  await db
    .update(kbArticles)
    .set({ viewCount: sql`${kbArticles.viewCount} + 1` })
    .where(eq(kbArticles.id, id));
}
