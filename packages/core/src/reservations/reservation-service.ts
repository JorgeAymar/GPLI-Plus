import { assets, db, reservationItems, reservations, type Asset, type Reservation, type ReservationItem } from "@itsm/db";
import { and, asc, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

export async function createReservationItem(input: { assetId: string; comment?: string | null }): Promise<ReservationItem> {
  const [created] = await db
    .insert(reservationItems)
    .values({
      assetId: input.assetId,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert reservation item");
  return created;
}

/**
 * Active reservation items scoped to an entity (+ subtree), joined with their
 * asset so callers get both the booking config and the underlying asset in
 * one shot. Drizzle keys an innerJoin's result by each table's SQL name
 * (the string passed to pgTable), not the JS variable - so this is
 * `r.reservation_items` / `r.assets`, matching the pattern in computer-service.ts.
 */
export async function listReservationItems(
  entityId: string,
  options?: { includeSubtree?: boolean },
): Promise<Array<{ item: ReservationItem; asset: Asset }>> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];

  const rows = await db
    .select()
    .from(reservationItems)
    .innerJoin(assets, eq(assets.id, reservationItems.assetId))
    .where(and(inArray(assets.entityId, entityIds), eq(reservationItems.isActive, true), isNull(assets.deletedAt)))
    .orderBy(assets.name);

  return rows.map((r) => ({ item: r.reservation_items, asset: r.assets }));
}

export async function getReservationItem(id: string): Promise<ReservationItem | undefined> {
  const [item] = await db.select().from(reservationItems).where(eq(reservationItems.id, id));
  return item;
}

function conflictMessage(conflict: Reservation): string {
  return `Conflicto de horario: el recurso ya está reservado entre ${conflict.beginAt.toISOString()} y ${conflict.endAt.toISOString()}`;
}

/** Reservations for the same item whose [beginAt,endAt) range overlaps the given one (classic open-range overlap). */
async function findOverlappingReservation(reservationItemId: string, beginAt: Date, endAt: Date): Promise<Reservation | undefined> {
  const [conflict] = await db
    .select()
    .from(reservations)
    .where(
      and(eq(reservations.reservationItemId, reservationItemId), gt(reservations.endAt, beginAt), lt(reservations.beginAt, endAt)),
    );
  return conflict;
}

export async function createReservation(input: {
  reservationItemId: string;
  beginAt: Date;
  endAt: Date;
  requestedByUserId: string;
  comment?: string | null;
}): Promise<Reservation> {
  const conflict = await findOverlappingReservation(input.reservationItemId, input.beginAt, input.endAt);
  if (conflict) throw new Error(conflictMessage(conflict));

  const [created] = await db
    .insert(reservations)
    .values({
      reservationItemId: input.reservationItemId,
      beginAt: input.beginAt,
      endAt: input.endAt,
      requestedByUserId: input.requestedByUserId,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert reservation");
  return created;
}

/**
 * Creates one reservation per date in `dates`, all sharing a fresh
 * seriesGroupId. Never aborts the whole series on a single conflict - a
 * date that overlaps an existing (or earlier-in-this-same-series) booking
 * is skipped and reported back, never silently dropped.
 */
export async function createRecurringReservations(input: {
  reservationItemId: string;
  requestedByUserId: string;
  dates: Array<{ beginAt: Date; endAt: Date }>;
  comment?: string | null;
}): Promise<{ created: Reservation[]; skipped: Array<{ beginAt: Date; endAt: Date; reason: string }> }> {
  const seriesGroupId = crypto.randomUUID();
  const created: Reservation[] = [];
  const skipped: Array<{ beginAt: Date; endAt: Date; reason: string }> = [];

  for (const date of input.dates) {
    const conflict = await findOverlappingReservation(input.reservationItemId, date.beginAt, date.endAt);
    if (conflict) {
      skipped.push({ beginAt: date.beginAt, endAt: date.endAt, reason: conflictMessage(conflict) });
      continue;
    }

    const [row] = await db
      .insert(reservations)
      .values({
        reservationItemId: input.reservationItemId,
        beginAt: date.beginAt,
        endAt: date.endAt,
        requestedByUserId: input.requestedByUserId,
        comment: input.comment ?? null,
        seriesGroupId,
      })
      .returning();
    if (!row) throw new Error("Failed to insert reservation");
    created.push(row);
  }

  return { created, skipped };
}

export async function listReservationsForItem(reservationItemId: string): Promise<Reservation[]> {
  return db
    .select()
    .from(reservations)
    .where(eq(reservations.reservationItemId, reservationItemId))
    .orderBy(asc(reservations.beginAt));
}

export async function cancelReservation(id: string): Promise<void> {
  await db.delete(reservations).where(eq(reservations.id, id));
}
