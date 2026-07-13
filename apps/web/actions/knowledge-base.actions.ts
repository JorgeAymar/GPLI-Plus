"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  addKbComment,
  createKbArticle,
  createKbArticleSchema,
  createKbCategory,
  createKbCategorySchema,
  createKbCommentSchema,
  requireRight,
  revertKbArticle,
  updateKbArticle,
  updateKbArticleSchema,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createKbArticleAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_KNOWLEDGE_BASE, RIGHT.CREATE);
  const parsed = createKbArticleSchema.parse(input);
  const article = await createKbArticle(parsed, context.user.id);
  revalidatePath("/tools/knowledge-base");
  return article;
}

export async function updateKbArticleAction(id: string, input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_KNOWLEDGE_BASE, RIGHT.UPDATE);
  const parsed = updateKbArticleSchema.parse(input);
  const article = await updateKbArticle(id, parsed, context.user.id);
  revalidatePath(`/tools/knowledge-base/${id}`);
  return article;
}

export async function addKbCommentAction(input: unknown) {
  const context = await requireAuthContext();
  // Anyone who can read the KB can comment on it; RIGHT.CREATE kept for
  // consistency with every other action in this file rather than adding a
  // separate "comment" right.
  await requireRight(context, MODULE.TOOLS_KNOWLEDGE_BASE, RIGHT.CREATE);
  const parsed = createKbCommentSchema.parse(input);
  const comment = await addKbComment({ ...parsed, authorUserId: context.user.id });
  revalidatePath(`/tools/knowledge-base/${parsed.articleId}`);
  return comment;
}

export async function revertKbArticleAction(articleId: string, auditLogId: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_KNOWLEDGE_BASE, RIGHT.UPDATE);
  const article = await revertKbArticle(articleId, auditLogId, context.user.id);
  revalidatePath(`/tools/knowledge-base/${articleId}`);
  return article;
}

export async function createKbCategoryAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_KNOWLEDGE_BASE, RIGHT.CREATE);
  const parsed = createKbCategorySchema.parse(input);
  const category = await createKbCategory(parsed);
  revalidatePath("/tools/knowledge-base");
  return category;
}
