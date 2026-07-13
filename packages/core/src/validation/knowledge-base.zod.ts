import { z } from "zod";

export const createKbCategorySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateKbCategoryInput = z.infer<typeof createKbCategorySchema>;

export const createKbArticleSchema = z.object({
  entityId: z.string().uuid(),
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  isFaq: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  authorUserId: z.string().uuid(),
  showInServiceCatalog: z.boolean().optional(),
  beginDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});
export type CreateKbArticleInput = z.infer<typeof createKbArticleSchema>;

export const updateKbArticleSchema = createKbArticleSchema.omit({ entityId: true }).partial();
export type UpdateKbArticleInput = z.infer<typeof updateKbArticleSchema>;

export const createKbCommentSchema = z.object({
  articleId: z.string().uuid(),
  parentCommentId: z.string().uuid().nullable().optional(),
  content: z.string().min(1).max(5000),
});
export type CreateKbCommentInput = z.infer<typeof createKbCommentSchema>;
