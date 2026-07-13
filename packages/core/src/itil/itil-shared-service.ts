import {
  db,
  itilActors,
  itilCosts,
  itilTimelineItems,
  itilValidations,
  type ItilActor,
  type ItilActorKind,
  type ItilActorRole,
  type ItilCost,
  type ItilTimelineItem,
  type ItilTimelineItemType,
  type ItilType,
  type ItilValidation,
  type ItilValidationStatus,
  type ItilValidatorKind,
} from "@itsm/db";
import { and, eq } from "drizzle-orm";

/**
 * Satellite tables (actors, timeline, validations, costs) are identical in
 * shape and behavior for Ticket/Problem/Change, discriminated by
 * (itilType, itilId) - see packages/db/src/schema/itil-shared.ts. One
 * shared service instead of three near-identical copies.
 */

export async function addActor(
  itilType: ItilType,
  itilId: string,
  input: { actorRole: ItilActorRole; actorKind: ItilActorKind; actorId: string },
): Promise<ItilActor> {
  const [created] = await db
    .insert(itilActors)
    .values({ itilType, itilId, actorRole: input.actorRole, actorKind: input.actorKind, actorId: input.actorId })
    .returning();
  if (!created) throw new Error("Failed to insert itil actor");
  return created;
}

export async function listActors(itilType: ItilType, itilId: string): Promise<ItilActor[]> {
  return db.select().from(itilActors).where(and(eq(itilActors.itilType, itilType), eq(itilActors.itilId, itilId)));
}

export async function removeActor(id: string): Promise<void> {
  await db.delete(itilActors).where(eq(itilActors.id, id));
}

export async function addTimelineItem(
  itilType: ItilType,
  itilId: string,
  input: { itemType: ItilTimelineItemType; content: string; isPrivate?: boolean; createdBy: string; timeSpentMinutes?: number | null },
): Promise<ItilTimelineItem> {
  const [created] = await db
    .insert(itilTimelineItems)
    .values({
      itilType,
      itilId,
      itemType: input.itemType,
      content: input.content,
      isPrivate: input.isPrivate ?? false,
      createdBy: input.createdBy,
      timeSpentMinutes: input.timeSpentMinutes ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert itil timeline item");
  return created;
}

export async function listTimelineItems(itilType: ItilType, itilId: string): Promise<ItilTimelineItem[]> {
  return db
    .select()
    .from(itilTimelineItems)
    .where(and(eq(itilTimelineItems.itilType, itilType), eq(itilTimelineItems.itilId, itilId)))
    .orderBy(itilTimelineItems.createdAt);
}

export async function addValidation(
  itilType: ItilType,
  itilId: string,
  input: { validatorKind: ItilValidatorKind; validatorId: string; comment?: string | null },
): Promise<ItilValidation> {
  const [created] = await db
    .insert(itilValidations)
    .values({
      itilType,
      itilId,
      validatorKind: input.validatorKind,
      validatorId: input.validatorId,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert itil validation");
  return created;
}

export async function listValidations(itilType: ItilType, itilId: string): Promise<ItilValidation[]> {
  return db
    .select()
    .from(itilValidations)
    .where(and(eq(itilValidations.itilType, itilType), eq(itilValidations.itilId, itilId)));
}

export async function respondToValidation(
  id: string,
  status: Exclude<ItilValidationStatus, "waiting">,
  comment?: string | null,
): Promise<ItilValidation> {
  const [updated] = await db
    .update(itilValidations)
    .set({ status, comment: comment ?? null, respondedAt: new Date() })
    .where(eq(itilValidations.id, id))
    .returning();
  if (!updated) throw new Error(`Validation ${id} not found`);
  return updated;
}

export async function addCost(
  itilType: ItilType,
  itilId: string,
  input: { costType: string; amountCents: number; budgetId?: string | null; comment?: string | null },
): Promise<ItilCost> {
  const [created] = await db
    .insert(itilCosts)
    .values({
      itilType,
      itilId,
      costType: input.costType,
      amountCents: input.amountCents,
      budgetId: input.budgetId ?? null,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert itil cost");
  return created;
}

export async function listCosts(itilType: ItilType, itilId: string): Promise<ItilCost[]> {
  return db.select().from(itilCosts).where(and(eq(itilCosts.itilType, itilType), eq(itilCosts.itilId, itilId)));
}
