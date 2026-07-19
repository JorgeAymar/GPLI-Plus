import { type AnyPgColumn, boolean, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { users } from "./users";

/**
 * Categories form a tree (self-FK on parentId, same pattern as dropdownItems)
 * but are NOT entity-scoped: a KB category tree is shared globally, articles
 * themselves carry the entity scope (and thus the visibility boundary).
 */
export const kbCategories = pgTable(
  "kb_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => kbCategories.id),
    name: text("name").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("kb_categories_parent_idx").on(table.parentId)],
);

/**
 * No dedicated revision-history table: every update() call writes a
 * before/after pair to the generic audit_log (see kb-service.ts
 * listKbArticleRevisions/revertKbArticle), the same append-only log every
 * other module reuses instead of per-module audit tables.
 */
export const kbArticles = pgTable(
  "kb_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isFaq: boolean("is_faq").notNull().default(false),
    isPinned: boolean("is_pinned").notNull().default(false),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    viewCount: integer("view_count").notNull().default(0),
    showInServiceCatalog: boolean("show_in_service_catalog").notNull().default(false),
    beginDate: timestamp("begin_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("kb_articles_entity_idx").on(table.entityId), index("kb_articles_author_idx").on(table.authorUserId)],
);

/** Many-to-many pivot, same composite-PK pattern as contractAssets in contracts.ts. */
export const kbArticleCategories = pgTable(
  "kb_article_categories",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => kbArticles.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => kbCategories.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.categoryId] }),
    index("kb_article_categories_category_idx").on(table.categoryId),
  ],
);

/** Flat storage, self-FK on parentCommentId for threaded replies - the UI nests them. */
export const kbArticleComments = pgTable(
  "kb_article_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => kbArticles.id, { onDelete: "cascade" }),
    parentCommentId: uuid("parent_comment_id").references((): AnyPgColumn => kbArticleComments.id),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("kb_article_comments_article_idx").on(table.articleId),
    index("kb_article_comments_author_idx").on(table.authorUserId),
    index("kb_article_comments_parent_idx").on(table.parentCommentId),
  ],
);

export type KbCategory = typeof kbCategories.$inferSelect;
export type NewKbCategory = typeof kbCategories.$inferInsert;
export type KbArticle = typeof kbArticles.$inferSelect;
export type NewKbArticle = typeof kbArticles.$inferInsert;
export type KbArticleCategory = typeof kbArticleCategories.$inferSelect;
export type NewKbArticleCategory = typeof kbArticleCategories.$inferInsert;
export type KbArticleComment = typeof kbArticleComments.$inferSelect;
export type NewKbArticleComment = typeof kbArticleComments.$inferInsert;
