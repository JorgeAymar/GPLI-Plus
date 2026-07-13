"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  cancelReservation,
  createReservation,
  createReservationItem,
  createReservationItemSchema,
  createReservationSchema,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createReservationItemAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_RESERVATION, RIGHT.CREATE);
  const parsed = createReservationItemSchema.parse(input);
  const item = await createReservationItem(parsed);
  revalidatePath("/tools/reservations");
  return item;
}

export async function createReservationAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_RESERVATION, RIGHT.CREATE);
  // requestedByUserId always comes from the authenticated session, never from
  // client-submitted form data, so a reservation can't be attributed to another user.
  const parsed = createReservationSchema.parse({
    ...(input as Record<string, unknown>),
    requestedByUserId: context.user.id,
  });
  // createReservation() throws a plain business-rule Error on a schedule conflict.
  // It must NOT be caught/rewrapped here - the client form needs the real message
  // ("Conflicto de horario: ...") instead of a generic failure.
  const reservation = await createReservation(parsed);
  revalidatePath(`/tools/reservations/${parsed.reservationItemId}`);
  return reservation;
}

export async function cancelReservationAction(id: string, reservationItemId: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_RESERVATION, RIGHT.DELETE);
  await cancelReservation(id);
  revalidatePath(`/tools/reservations/${reservationItemId}`);
}
