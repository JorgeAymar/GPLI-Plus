import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  auditLog,
  db,
  kbArticleCategories,
  kbArticleComments,
  kbArticles,
  kbCategories,
  resourceVisibilityRules,
  type Entity,
  type Profile,
  type User,
} from "@itsm/db";
import {
  buildAuthContext,
  createTestEntity,
  createTestProfile,
  createTestUser,
  deleteTestEntities,
  deleteTestProfiles,
  deleteTestUsers,
} from "../__vitest_tools__/fixtures";
import { addVisibilityRule } from "../visibility/visibility-service";
import {
  addKbArticleCategory,
  addKbComment,
  createKbArticle,
  createKbCategory,
  getKbArticle,
  incrementKbArticleViewCount,
  listKbArticleCategories,
  listKbArticleRevisions,
  listKbArticles,
  listKbComments,
  removeKbArticleCategory,
  revertKbArticle,
  updateKbArticle,
} from "./kb-service";

describe("kb-service", () => {
  let entity: Entity;
  let author: User;
  let otherUser: User;
  let profile: Profile;

  const entityIds: string[] = [];
  const userIds: string[] = [];
  const profileIds: string[] = [];
  const articleIds: string[] = [];
  const categoryIds: string[] = [];

  beforeAll(async () => {
    entity = await createTestEntity();
    entityIds.push(entity.id);
    author = await createTestUser();
    otherUser = await createTestUser();
    userIds.push(author.id, otherUser.id);
    profile = await createTestProfile();
    profileIds.push(profile.id);
  });

  afterAll(async () => {
    for (const articleId of articleIds) {
      await db.delete(auditLog).where(eq(auditLog.objectId, articleId));
      await db.delete(resourceVisibilityRules).where(eq(resourceVisibilityRules.resourceId, articleId));
      await db.delete(kbArticleComments).where(eq(kbArticleComments.articleId, articleId));
      await db.delete(kbArticleCategories).where(eq(kbArticleCategories.articleId, articleId));
    }
    if (articleIds.length > 0) {
      await db.delete(kbArticles).where(eq(kbArticles.entityId, entity.id));
    }
    for (const categoryId of categoryIds) {
      await db.delete(kbCategories).where(eq(kbCategories.id, categoryId));
    }
    await deleteTestProfiles(profileIds);
    await deleteTestUsers(userIds);
    await deleteTestEntities(entityIds);
  });

  it("createKbArticle + getKbArticle roundtrip, and records a create audit log entry", async () => {
    const article = await createKbArticle(
      { entityId: entity.id, title: "__vitest_tools__ Article", body: "body v1", authorUserId: author.id },
      author.id,
    );
    articleIds.push(article.id);

    const fetched = await getKbArticle(article.id);
    expect(fetched?.title).toBe("__vitest_tools__ Article");

    const revisions = await listKbArticleRevisions(article.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.action).toBe("create");
  });

  it("updateKbArticle writes a before/after audit_log entry, and revertKbArticle restores the prior version", async () => {
    const article = await createKbArticle(
      { entityId: entity.id, title: "__vitest_tools__ Revert me", body: "original body", authorUserId: author.id },
      author.id,
    );
    articleIds.push(article.id);

    const updated = await updateKbArticle(article.id, { title: "__vitest_tools__ Updated title" }, author.id);
    expect(updated.title).toBe("__vitest_tools__ Updated title");

    const revisions = await listKbArticleRevisions(article.id);
    expect(revisions).toHaveLength(2);
    const updateEntry = revisions.find((r) => r.action === "update");
    expect(updateEntry).toBeDefined();
    expect((updateEntry?.before as { title?: string } | null)?.title).toBe("__vitest_tools__ Revert me");

    const reverted = await revertKbArticle(article.id, updateEntry!.id, author.id);
    expect(reverted.title).toBe("__vitest_tools__ Revert me");
  });

  it("a private KB article is invisible to another user until explicitly shared, then becomes visible", async () => {
    const article = await createKbArticle(
      { entityId: entity.id, title: "__vitest_tools__ Private article", body: "secret body", authorUserId: author.id },
      author.id,
    );
    articleIds.push(article.id);

    const authorContext = buildAuthContext(author, entity, profile);
    const otherContext = buildAuthContext(otherUser, entity, profile);

    const ownVisible = await listKbArticles(authorContext);
    expect(ownVisible.map((a) => a.id)).toContain(article.id);

    const beforeShare = await listKbArticles(otherContext);
    expect(beforeShare.map((a) => a.id)).not.toContain(article.id);

    await addVisibilityRule({ resourceType: "kb_article", resourceId: article.id, granteeKind: "user", granteeId: otherUser.id });

    const afterShare = await listKbArticles(otherContext);
    expect(afterShare.map((a) => a.id)).toContain(article.id);
  });

  it("listKbArticles excludes articles outside their effective begin/end date window", async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 86_400_000);
    const farFuture = new Date(now.getTime() + 60 * 86_400_000);

    const notYetEffective = await createKbArticle(
      {
        entityId: entity.id,
        title: "__vitest_tools__ Not yet effective",
        body: "future article",
        authorUserId: author.id,
        beginDate: future,
        endDate: farFuture,
      },
      author.id,
    );
    articleIds.push(notYetEffective.id);

    const authorContext = buildAuthContext(author, entity, profile);
    const visible = await listKbArticles(authorContext);
    expect(visible.map((a) => a.id)).not.toContain(notYetEffective.id);
  });

  it("listKbArticles honors the onlyFaq and search filters", async () => {
    const faqArticle = await createKbArticle(
      { entityId: entity.id, title: "__vitest_tools__ FAQ zzyzx", body: "faq body", authorUserId: author.id, isFaq: true },
      author.id,
    );
    const regularArticle = await createKbArticle(
      { entityId: entity.id, title: "__vitest_tools__ Regular zzyzx", body: "regular body", authorUserId: author.id },
      author.id,
    );
    articleIds.push(faqArticle.id, regularArticle.id);

    const authorContext = buildAuthContext(author, entity, profile);

    const onlyFaq = await listKbArticles(authorContext, { onlyFaq: true });
    expect(onlyFaq.map((a) => a.id)).toContain(faqArticle.id);
    expect(onlyFaq.map((a) => a.id)).not.toContain(regularArticle.id);

    const searched = await listKbArticles(authorContext, { search: "zzyzx" });
    const searchedIds = searched.map((a) => a.id);
    expect(searchedIds).toContain(faqArticle.id);
    expect(searchedIds).toContain(regularArticle.id);
  });

  it("categories: create, attach, list, and detach from an article", async () => {
    const article = await createKbArticle(
      { entityId: entity.id, title: "__vitest_tools__ Categorized", body: "body", authorUserId: author.id },
      author.id,
    );
    articleIds.push(article.id);

    const category = await createKbCategory({ name: "__vitest_tools__ Category" });
    categoryIds.push(category.id);

    await addKbArticleCategory(article.id, category.id);
    let categories = await listKbArticleCategories(article.id);
    expect(categories.map((c) => c.id)).toContain(category.id);

    await removeKbArticleCategory(article.id, category.id);
    categories = await listKbArticleCategories(article.id);
    expect(categories.map((c) => c.id)).not.toContain(category.id);
  });

  it("comments: add and list in createdAt order", async () => {
    const article = await createKbArticle(
      { entityId: entity.id, title: "__vitest_tools__ Commented", body: "body", authorUserId: author.id },
      author.id,
    );
    articleIds.push(article.id);

    const first = await addKbComment({ articleId: article.id, authorUserId: author.id, content: "first" });
    const second = await addKbComment({ articleId: article.id, authorUserId: otherUser.id, content: "second" });

    const comments = await listKbComments(article.id);
    expect(comments.map((c) => c.id)).toEqual([first.id, second.id]);
  });

  it("incrementKbArticleViewCount increments the counter", async () => {
    const article = await createKbArticle(
      { entityId: entity.id, title: "__vitest_tools__ Viewed", body: "body", authorUserId: author.id },
      author.id,
    );
    articleIds.push(article.id);

    await incrementKbArticleViewCount(article.id);
    await incrementKbArticleViewCount(article.id);

    const fetched = await getKbArticle(article.id);
    expect(fetched?.viewCount).toBe(2);
  });
});
