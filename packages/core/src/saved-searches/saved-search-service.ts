import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import {
  assets,
  db,
  savedSearchAlerts,
  savedSearches,
  tickets,
  type SavedSearch,
  type SavedSearchAlert,
  type SavedSearchAlertOperator,
  type SavedSearchDoCount,
  type SavedSearchType,
} from "@itsm/db";
import { listSubtree } from "../entities/entity-service";
import { queueNotification } from "../notifications/notification-service";

export async function createSavedSearch(input: {
  name: string;
  itemType: string;
  ownerUserId: string;
  isPrivate?: boolean;
  entityId: string;
  isRecursive?: boolean;
  queryJson?: Record<string, unknown>;
  type?: SavedSearchType;
  doCount?: SavedSearchDoCount;
}): Promise<SavedSearch> {
  const [created] = await db
    .insert(savedSearches)
    .values({
      name: input.name,
      itemType: input.itemType,
      ownerUserId: input.ownerUserId,
      isPrivate: input.isPrivate ?? true,
      entityId: input.entityId,
      isRecursive: input.isRecursive ?? false,
      queryJson: input.queryJson ?? {},
      type: input.type ?? "bookmark",
      doCount: input.doCount ?? "auto",
    })
    .returning();
  if (!created) throw new Error("Failed to insert saved search");
  return created;
}

/** The caller's own saved searches, plus anyone else's shared (non-private) ones. */
export async function listSavedSearches(ownerUserId: string, itemType?: string): Promise<SavedSearch[]> {
  const conditions = [or(eq(savedSearches.ownerUserId, ownerUserId), eq(savedSearches.isPrivate, false))];
  if (itemType) conditions.push(eq(savedSearches.itemType, itemType));
  return db
    .select()
    .from(savedSearches)
    .where(and(...conditions))
    .orderBy(savedSearches.name);
}

export async function createSavedSearchAlert(input: {
  savedSearchId: string;
  operator: SavedSearchAlertOperator;
  thresholdValue: number;
  frequencyMinutes?: number;
  isActive?: boolean;
}): Promise<SavedSearchAlert> {
  const [created] = await db
    .insert(savedSearchAlerts)
    .values({
      savedSearchId: input.savedSearchId,
      operator: input.operator,
      thresholdValue: input.thresholdValue,
      frequencyMinutes: input.frequencyMinutes ?? 60,
      isActive: input.isActive ?? true,
    })
    .returning();
  if (!created) throw new Error("Failed to insert saved search alert");
  return created;
}

export interface ActiveSavedSearchAlert {
  alert: SavedSearchAlert;
  savedSearch: SavedSearch;
}

/** Joins in the parent saved search so the sweep gets itemType/entityId/doCount/ownerUserId without a second query per alert. */
export async function listActiveSavedSearchAlerts(): Promise<ActiveSavedSearchAlert[]> {
  return db
    .select({ alert: savedSearchAlerts, savedSearch: savedSearches })
    .from(savedSearchAlerts)
    .innerJoin(savedSearches, eq(savedSearches.id, savedSearchAlerts.savedSearchId))
    .where(eq(savedSearchAlerts.isActive, true));
}

/**
 * Deliberate, small, explicit registry - a documented scope cut vs. a generic
 * search/query engine: this system has no GLPI-style generic search builder,
 * so "how many items currently match this saved search" is resolved per
 * itemType by a dedicated resolver here instead of re-interpreting queryJson
 * generically. Add an entry per itemType as saved searches expand.
 *
 * Note: tickets have no soft-delete column (itil-shared.ts itilBaseColumns),
 * so the ticket resolver counts every ticket in the subtree; assets do have
 * deletedAt and are excluded when set.
 */
const COUNT_RESOLVERS: Record<string, (entityId: string) => Promise<number>> = {
  ticket: async (entityId) => {
    const entityIds = (await listSubtree(entityId)).map((e) => e.id);
    const [row] = await db.select({ value: count() }).from(tickets).where(inArray(tickets.entityId, entityIds));
    return row?.value ?? 0;
  },
  asset: async (entityId) => {
    const entityIds = (await listSubtree(entityId)).map((e) => e.id);
    const [row] = await db
      .select({ value: count() })
      .from(assets)
      .where(and(inArray(assets.entityId, entityIds), isNull(assets.deletedAt)));
    return row?.value ?? 0;
  },
};

export async function resolveSavedSearchCount(itemType: string, entityId: string): Promise<number | null> {
  const resolver = COUNT_RESOLVERS[itemType];
  return resolver ? resolver(entityId) : null;
}

function thresholdMet(operator: SavedSearchAlertOperator, currentCount: number, threshold: number): boolean {
  switch (operator) {
    case "lt":
      return currentCount < threshold;
    case "lte":
      return currentCount <= threshold;
    case "eq":
      return currentCount === threshold;
    case "gt":
      return currentCount > threshold;
    case "gte":
      return currentCount >= threshold;
    case "neq":
      return currentCount !== threshold;
    default:
      return false;
  }
}

/**
 * Recurring sweep - see apps/worker/src/jobs/saved-search-alerts.ts. For every
 * active alert: skips it if its saved search opted out (doCount="no"), skips
 * it if `frequencyMinutes` hasn't elapsed since the last check, otherwise
 * resolves the current count (skipping itemTypes with no registered
 * resolver) and queues a "saved_search_alert" notification when the
 * threshold condition is met. `lastCheckedAt` is always stamped, whether or
 * not the alert actually fired, so the throttle above is based on the last
 * check rather than the last fire. Returns how many notifications were queued.
 */
export async function runSavedSearchAlertsSweep(): Promise<number> {
  const activeAlerts = await listActiveSavedSearchAlerts();
  const now = new Date();
  let queued = 0;

  for (const { alert, savedSearch } of activeAlerts) {
    if (savedSearch.doCount === "no") continue;

    if (alert.lastCheckedAt) {
      const dueAt = new Date(alert.lastCheckedAt.getTime() + alert.frequencyMinutes * 60_000);
      if (now < dueAt) continue;
    }

    const currentCount = await resolveSavedSearchCount(savedSearch.itemType, savedSearch.entityId);
    if (currentCount === null) continue;

    if (thresholdMet(alert.operator, currentCount, alert.thresholdValue)) {
      await queueNotification("saved_search_alert", savedSearch.ownerUserId, {
        savedSearchName: savedSearch.name,
        count: currentCount,
        threshold: alert.thresholdValue,
      });
      queued++;
    }

    await db.update(savedSearchAlerts).set({ lastCheckedAt: now }).where(eq(savedSearchAlerts.id, alert.id));
  }

  return queued;
}
