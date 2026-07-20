import { createHmac } from "crypto";
import {
  db,
  queuedWebhooks,
  webhooks,
  type QueuedWebhook,
  type QueuedWebhookStatus,
  type Webhook,
  type WebhookEvent,
} from "@itsm/db";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { listAncestors, listSubtree } from "../entities/entity-service";
import { isSafeExternalUrl } from "../url-safety";

/** Simple linear backoff: nextAttemptAt = now + attempt * 5 minutes. */
const RETRY_BACKOFF_MINUTES = 5;

export async function createWebhook(input: {
  entityId: string;
  name: string;
  itemType: string;
  event: WebhookEvent;
  url: string;
  secret: string;
  customHeaders?: Record<string, string>;
  maxRetries?: number;
}): Promise<Webhook> {
  // Anti-SSRF guard: webhook URLs are user-supplied and later POSTed to
  // server-side by dispatchPendingWebhooks() on every matching event, so
  // without this a webhook could be pointed at cloud-metadata endpoints,
  // internal services, or loopback addresses - and unlike RSS feeds (which
  // only fetch on a schedule), an active webhook fires on every matching
  // event, making an unnoticed unsafe URL here more actively exploitable.
  if (!isSafeExternalUrl(input.url)) throw new Error("La URL del webhook no es válida o apunta a una dirección no permitida.");

  const [created] = await db
    .insert(webhooks)
    .values({
      entityId: input.entityId,
      name: input.name,
      itemType: input.itemType,
      event: input.event,
      url: input.url,
      secret: input.secret,
      customHeaders: input.customHeaders ?? null,
      maxRetries: input.maxRetries ?? 3,
    })
    .returning();
  if (!created) throw new Error("Failed to insert webhook");
  return created;
}

export async function getWebhook(id: string): Promise<Webhook | undefined> {
  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id));
  return webhook;
}

export async function listWebhooks(entityId: string, options?: { includeSubtree?: boolean }): Promise<Webhook[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(webhooks)
    .where(inArray(webhooks.entityId, entityIds))
    .orderBy(webhooks.name);
}

/**
 * Fires every active webhook matching (itemType, event) that is registered on `entityId` or on one
 * of its ANCESTOR entities - i.e. a webhook configured on a parent entity also fires for events in
 * its sub-entities, mirroring the `isRecursive` convention used elsewhere in the codebase (see
 * userProfiles.isRecursive / visibility-service.ts). It does NOT look at entityId's descendants,
 * since entityId here is the concrete entity the event happened in, not a scope to fan out from.
 * One row is queued per matching webhook so a single misconfigured/unreachable endpoint never
 * blocks delivery to the others. Errors are the caller's responsibility to swallow (see
 * ticket-service.ts / asset-service.ts, which call this with `.catch(() => {})`).
 */
export async function raiseWebhookEvent(
  itemType: string,
  event: "create" | "update" | "delete",
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const ancestorIds = (await listAncestors(entityId)).map((e) => e.id);
  if (ancestorIds.length === 0) return;

  const matches = await db
    .select()
    .from(webhooks)
    .where(
      and(
        inArray(webhooks.entityId, ancestorIds),
        eq(webhooks.itemType, itemType),
        eq(webhooks.event, event),
        eq(webhooks.isActive, true),
      ),
    );

  if (matches.length === 0) return;

  await db.insert(queuedWebhooks).values(
    matches.map((webhook) => ({
      webhookId: webhook.id,
      payload,
    })),
  );
}

export async function listPendingWebhooks(): Promise<QueuedWebhook[]> {
  return db
    .select()
    .from(queuedWebhooks)
    .where(and(eq(queuedWebhooks.status, "pending"), lte(queuedWebhooks.nextAttemptAt, new Date())));
}

export async function listQueuedWebhooksForWebhook(webhookId: string): Promise<QueuedWebhook[]> {
  return db
    .select()
    .from(queuedWebhooks)
    .where(eq(queuedWebhooks.webhookId, webhookId))
    .orderBy(desc(queuedWebhooks.createdAt));
}

async function recordFailedAttempt(queued: QueuedWebhook, webhook: Webhook, statusCode: number | null, error: string): Promise<void> {
  const attempt = queued.attempt + 1;
  const patch: { attempt: number; lastStatusCode: number | null; lastError: string; status: QueuedWebhookStatus; nextAttemptAt?: Date } = {
    attempt,
    lastStatusCode: statusCode,
    lastError: error,
    status: attempt >= webhook.maxRetries ? "failed" : "pending",
  };
  if (patch.status === "pending") {
    patch.nextAttemptAt = new Date(Date.now() + attempt * RETRY_BACKOFF_MINUTES * 60 * 1000);
  }
  await db.update(queuedWebhooks).set(patch).where(eq(queuedWebhooks.id, queued.id));
}

/** Drains every due `queuedWebhooks` row (status="pending", nextAttemptAt <= now), POSTing an
 * HMAC-signed payload to each webhook's url. Called by apps/worker's webhook-dispatch job. */
export async function dispatchPendingWebhooks(): Promise<{ sent: number; failed: number }> {
  const pending = await listPendingWebhooks();
  let sent = 0;
  let failed = 0;

  for (const queued of pending) {
    const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, queued.webhookId));
    if (!webhook) {
      await db
        .update(queuedWebhooks)
        .set({ status: "failed", lastError: `Webhook ${queued.webhookId} not found` })
        .where(eq(queuedWebhooks.id, queued.id));
      failed++;
      continue;
    }

    // Defense-in-depth, not the primary guard (createWebhook already rejects
    // an unsafe URL at creation time) - covers a webhook row written before
    // this check existed, or a URL edited directly at the DB level.
    if (!isSafeExternalUrl(webhook.url)) {
      await recordFailedAttempt(queued, webhook, null, "Webhook URL no permitida (SSRF guard).");
      failed++;
      continue;
    }

    const body = JSON.stringify(queued.payload);
    const hmacHex = createHmac("sha256", webhook.secret).update(body).digest("hex");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Signature": hmacHex,
      ...((webhook.customHeaders as Record<string, string> | null) ?? {}),
    };

    try {
      const response = await fetch(webhook.url, { method: "POST", headers, body });
      if (response.ok) {
        await db
          .update(queuedWebhooks)
          .set({ status: "sent", sentAt: new Date(), lastStatusCode: response.status })
          .where(eq(queuedWebhooks.id, queued.id));
        sent++;
      } else {
        await recordFailedAttempt(queued, webhook, response.status, `HTTP ${response.status}`);
        failed++;
      }
    } catch (err) {
      await recordFailedAttempt(queued, webhook, null, err instanceof Error ? err.message : String(err));
      failed++;
    }
  }

  return { sent, failed };
}
