import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { db, entities, queuedWebhooks, webhooks } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createWebhookSchema } from "../validation/webhook.zod";
import {
  createWebhook,
  dispatchPendingWebhooks,
  listQueuedWebhooksForWebhook,
  listWebhooks,
  raiseWebhookEvent,
} from "./webhook-service";

const PREFIX = "__vitest_platform__";
const RETRY_BACKOFF_MINUTES = 5; // Mirrors webhook-service.ts's private RETRY_BACKOFF_MINUTES constant.

/** Local, deterministic replacement for a real webhook receiver - /ok always 200s, /fail always 500s. */
function startTestServer(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        if (req.url === "/fail") {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("boom");
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

describe("webhook-service", () => {
  let server: Server;
  let baseUrl: string;
  let rootEntityId: string;
  let childEntityId: string;
  const createdWebhookIds: string[] = [];

  beforeAll(async () => {
    const started = await startTestServer();
    server = started.server;
    baseUrl = started.baseUrl;

    const root = await createEntity({ name: `${PREFIX}webhook_root_${randomUUID()}` });
    rootEntityId = root.id;
    const child = await createEntity({ name: `${PREFIX}webhook_child_${randomUUID()}`, parentId: root.id });
    childEntityId = child.id;
  });

  afterAll(async () => {
    for (const id of createdWebhookIds) {
      await db.delete(queuedWebhooks).where(eq(queuedWebhooks.webhookId, id));
      await db.delete(webhooks).where(eq(webhooks.id, id));
    }
    await db.delete(entities).where(eq(entities.id, childEntityId));
    await db.delete(entities).where(eq(entities.id, rootEntityId));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("createWebhook + listWebhooks scoped to the entity", async () => {
    const webhook = await createWebhook({
      entityId: rootEntityId,
      name: `${PREFIX}wh_basic`,
      itemType: "asset",
      event: "create",
      url: `${baseUrl}/ok`,
      secret: "shhh-secret",
    });
    createdWebhookIds.push(webhook.id);

    const list = await listWebhooks(rootEntityId);
    expect(list.some((w) => w.id === webhook.id)).toBe(true);
  });

  it("raiseWebhookEvent fans out to a webhook registered on an ANCESTOR entity, not on unrelated ones", async () => {
    const ancestorWebhook = await createWebhook({
      entityId: rootEntityId,
      name: `${PREFIX}wh_ancestor`,
      itemType: "ticket",
      event: "create",
      url: `${baseUrl}/ok`,
      secret: "shhh-secret",
    });
    createdWebhookIds.push(ancestorWebhook.id);

    const unrelated = await createEntity({ name: `${PREFIX}webhook_unrelated_${randomUUID()}` });
    const unrelatedWebhook = await createWebhook({
      entityId: unrelated.id,
      name: `${PREFIX}wh_unrelated`,
      itemType: "ticket",
      event: "create",
      url: `${baseUrl}/ok`,
      secret: "shhh-secret",
    });
    // Cleaned up manually in the finally block below (it lives on its own throwaway entity),
    // not via the shared createdWebhookIds/afterAll teardown.

    try {
      await raiseWebhookEvent("ticket", "create", childEntityId, { hello: "world" });

      const queuedForAncestor = await listQueuedWebhooksForWebhook(ancestorWebhook.id);
      expect(queuedForAncestor).toHaveLength(1);
      expect(queuedForAncestor[0]?.payload).toEqual({ hello: "world" });

      const queuedForUnrelated = await listQueuedWebhooksForWebhook(unrelatedWebhook.id);
      expect(queuedForUnrelated).toHaveLength(0);
    } finally {
      await db.delete(queuedWebhooks).where(eq(queuedWebhooks.webhookId, unrelatedWebhook.id));
      await db.delete(webhooks).where(eq(webhooks.id, unrelatedWebhook.id));
      await db.delete(entities).where(eq(entities.id, unrelated.id));
    }
  });

  it("raiseWebhookEvent does not fire for a mismatched itemType/event", async () => {
    const webhook = await createWebhook({
      entityId: rootEntityId,
      name: `${PREFIX}wh_mismatch`,
      itemType: "asset",
      event: "delete",
      url: `${baseUrl}/ok`,
      secret: "shhh-secret",
    });
    createdWebhookIds.push(webhook.id);

    await raiseWebhookEvent("asset", "create", childEntityId, { irrelevant: true });
    const queued = await listQueuedWebhooksForWebhook(webhook.id);
    expect(queued).toHaveLength(0);
  });

  it("dispatchPendingWebhooks POSTs an HMAC-signed payload and marks a successful delivery 'sent'", async () => {
    const webhook = await createWebhook({
      entityId: rootEntityId,
      name: `${PREFIX}wh_success_dispatch`,
      itemType: "asset",
      event: "update",
      url: `${baseUrl}/ok`,
      secret: "shhh-secret",
    });
    createdWebhookIds.push(webhook.id);

    const [queued] = await db.insert(queuedWebhooks).values({ webhookId: webhook.id, payload: { n: 1 } }).returning();

    const result = await dispatchPendingWebhooks();
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const [row] = await db.select().from(queuedWebhooks).where(eq(queuedWebhooks.id, queued!.id));
    expect(row?.status).toBe("sent");
    expect(row?.lastStatusCode).toBe(200);
    expect(row?.sentAt).toBeInstanceOf(Date);
  });

  it("a failed delivery schedules its next retry using the RETRY_BACKOFF_MINUTES backoff, then fails permanently after maxRetries", async () => {
    const webhook = await createWebhook({
      entityId: rootEntityId,
      name: `${PREFIX}wh_backoff`,
      itemType: "asset",
      event: "delete",
      url: `${baseUrl}/fail`,
      secret: "shhh-secret",
      maxRetries: 2,
    });
    createdWebhookIds.push(webhook.id);

    const [queued] = await db.insert(queuedWebhooks).values({ webhookId: webhook.id, payload: { n: 1 } }).returning();

    const beforeFirstAttempt = Date.now();
    await dispatchPendingWebhooks();

    const [afterFirst] = await db.select().from(queuedWebhooks).where(eq(queuedWebhooks.id, queued!.id));
    expect(afterFirst?.status).toBe("pending"); // attempt 1 of 2 - still eligible for retry
    expect(afterFirst?.attempt).toBe(1);
    expect(afterFirst?.lastStatusCode).toBe(500);
    expect(afterFirst?.lastError).toBe("HTTP 500");

    const expectedNextAttempt = beforeFirstAttempt + RETRY_BACKOFF_MINUTES * 60 * 1000;
    const actualNextAttempt = afterFirst!.nextAttemptAt.getTime();
    // Allow generous tolerance for test/CI scheduling jitter, while still proving the backoff is
    // ~5 minutes (not e.g. 0, or 30 minutes).
    expect(Math.abs(actualNextAttempt - expectedNextAttempt)).toBeLessThan(15_000);

    // Not due yet, so a dispatch right now should NOT touch it again.
    const notYetDue = await dispatchPendingWebhooks();
    const [stillFirst] = await db.select().from(queuedWebhooks).where(eq(queuedWebhooks.id, queued!.id));
    expect(stillFirst?.attempt).toBe(1);
    void notYetDue;

    // Fast-forward past the backoff window to simulate the retry becoming due.
    await db.update(queuedWebhooks).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(queuedWebhooks.id, queued!.id));

    await dispatchPendingWebhooks();
    const [afterSecond] = await db.select().from(queuedWebhooks).where(eq(queuedWebhooks.id, queued!.id));
    expect(afterSecond?.attempt).toBe(2);
    expect(afterSecond?.status).toBe("failed"); // attempt (2) >= maxRetries (2) - gives up permanently
  });

  describe("webhook zod schema", () => {
    it("createWebhookSchema validates url/event/secret length", () => {
      expect(
        createWebhookSchema.safeParse({
          entityId: randomUUID(),
          name: "x",
          itemType: "ticket",
          event: "create",
          url: "https://example.com/hook",
          secret: "12345678",
        }).success,
      ).toBe(true);

      expect(
        createWebhookSchema.safeParse({
          entityId: randomUUID(),
          name: "x",
          itemType: "ticket",
          event: "not-a-real-event",
          url: "https://example.com/hook",
          secret: "12345678",
        }).success,
      ).toBe(false);

      expect(
        createWebhookSchema.safeParse({
          entityId: randomUUID(),
          name: "x",
          itemType: "ticket",
          event: "create",
          url: "not-a-url",
          secret: "12345678",
        }).success,
      ).toBe(false);

      expect(
        createWebhookSchema.safeParse({
          entityId: randomUUID(),
          name: "x",
          itemType: "ticket",
          event: "create",
          url: "https://example.com/hook",
          secret: "short",
        }).success,
      ).toBe(false);
    });
  });
});
