import {
  cables,
  clusterMembers,
  db,
  enclosureSlots,
  rackSlots,
  type Cable,
  type ClusterMember,
  type EnclosureSlot,
  type RackSlot,
  type RackSlotOrientation,
} from "@itsm/db";
import { and, asc, eq, gt, isNotNull, lt, or, sql } from "drizzle-orm";

function rackOverlapMessage(conflict: RackSlot, positionU: number, unitHeight: number): string {
  return `Conflicto de posición: la U ${positionU} (altura ${unitHeight}) se solapa con el slot existente en la U ${conflict.positionU} (altura ${conflict.unitHeight}, orientación ${conflict.orientation})`;
}

/**
 * Rack slots in the same rack+orientation whose [positionU, positionU+unitHeight)
 * range overlaps the given one. Same classic open-range overlap principle as
 * findOverlappingReservation in reservation-service.ts, but with integer U
 * positions instead of dates: existing.positionU < new.positionU+new.unitHeight
 * AND new.positionU < existing.positionU+existing.unitHeight.
 */
async function findOverlappingRackSlot(
  rackAssetId: string,
  orientation: RackSlotOrientation,
  positionU: number,
  unitHeight: number,
): Promise<RackSlot | undefined> {
  const [conflict] = await db
    .select()
    .from(rackSlots)
    .where(
      and(
        eq(rackSlots.rackAssetId, rackAssetId),
        eq(rackSlots.orientation, orientation),
        lt(rackSlots.positionU, positionU + unitHeight),
        gt(sql<number>`${rackSlots.positionU} + ${rackSlots.unitHeight}`, positionU),
      ),
    );
  return conflict;
}

export async function placeInRack(input: {
  rackAssetId: string;
  occupantAssetId: string;
  positionU: number;
  unitHeight?: number;
  orientation?: RackSlotOrientation;
}): Promise<RackSlot> {
  const unitHeight = input.unitHeight ?? 1;
  const orientation = input.orientation ?? "front";

  const conflict = await findOverlappingRackSlot(input.rackAssetId, orientation, input.positionU, unitHeight);
  if (conflict) throw new Error(rackOverlapMessage(conflict, input.positionU, unitHeight));

  const [created] = await db
    .insert(rackSlots)
    .values({
      rackAssetId: input.rackAssetId,
      occupantAssetId: input.occupantAssetId,
      positionU: input.positionU,
      unitHeight,
      orientation,
    })
    .returning();
  if (!created) throw new Error("Failed to insert rack slot");
  return created;
}

export async function listRackSlots(rackAssetId: string): Promise<RackSlot[]> {
  return db.select().from(rackSlots).where(eq(rackSlots.rackAssetId, rackAssetId)).orderBy(asc(rackSlots.positionU));
}

export async function removeFromRack(id: string): Promise<void> {
  await db.delete(rackSlots).where(eq(rackSlots.id, id));
}

export async function placeInEnclosure(input: {
  enclosureAssetId: string;
  occupantAssetId: string;
  positionSlot: number;
}): Promise<EnclosureSlot> {
  const [existing] = await db
    .select()
    .from(enclosureSlots)
    .where(
      and(
        eq(enclosureSlots.enclosureAssetId, input.enclosureAssetId),
        eq(enclosureSlots.positionSlot, input.positionSlot),
        isNotNull(enclosureSlots.occupantAssetId),
      ),
    );
  if (existing) throw new Error(`Conflicto de posición: el slot ${input.positionSlot} del chasis ya está ocupado`);

  const [created] = await db
    .insert(enclosureSlots)
    .values({
      enclosureAssetId: input.enclosureAssetId,
      occupantAssetId: input.occupantAssetId,
      positionSlot: input.positionSlot,
    })
    .returning();
  if (!created) throw new Error("Failed to insert enclosure slot");
  return created;
}

export async function listEnclosureSlots(enclosureAssetId: string): Promise<EnclosureSlot[]> {
  return db
    .select()
    .from(enclosureSlots)
    .where(eq(enclosureSlots.enclosureAssetId, enclosureAssetId))
    .orderBy(asc(enclosureSlots.positionSlot));
}

export async function removeFromEnclosure(id: string): Promise<void> {
  await db.delete(enclosureSlots).where(eq(enclosureSlots.id, id));
}

export async function addClusterMember(clusterAssetId: string, memberAssetId: string): Promise<ClusterMember> {
  const [created] = await db.insert(clusterMembers).values({ clusterAssetId, memberAssetId }).returning();
  if (!created) throw new Error("Failed to insert cluster member");
  return created;
}

export async function removeClusterMember(clusterAssetId: string, memberAssetId: string): Promise<void> {
  await db
    .delete(clusterMembers)
    .where(and(eq(clusterMembers.clusterAssetId, clusterAssetId), eq(clusterMembers.memberAssetId, memberAssetId)));
}

export async function listClusterMembers(clusterAssetId: string): Promise<ClusterMember[]> {
  return db.select().from(clusterMembers).where(eq(clusterMembers.clusterAssetId, clusterAssetId));
}

export async function createCable(input: {
  name?: string | null;
  endpointAAssetId: string;
  endpointBAssetId: string;
  cableTypeDropdownItemId?: string | null;
  comment?: string | null;
}): Promise<Cable> {
  const [created] = await db
    .insert(cables)
    .values({
      name: input.name ?? null,
      endpointAAssetId: input.endpointAAssetId,
      endpointBAssetId: input.endpointBAssetId,
      cableTypeDropdownItemId: input.cableTypeDropdownItemId ?? null,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert cable");
  return created;
}

/** Cables for which the given asset is either endpoint A or endpoint B. */
export async function listCablesForAsset(assetId: string): Promise<Cable[]> {
  return db
    .select()
    .from(cables)
    .where(or(eq(cables.endpointAAssetId, assetId), eq(cables.endpointBAssetId, assetId)));
}

/**
 * All cables, newest first. Not in the original spec's function list (which only
 * has listCablesForAsset) but needed for the cables index page, which lists every
 * cable rather than scoping to one asset.
 */
export async function listCables(): Promise<Cable[]> {
  return db.select().from(cables).orderBy(asc(cables.createdAt));
}
